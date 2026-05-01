// @ts-nocheck
// GET /api/trial-lesson/teachers?slot=ISO
// Возвращает список преподавателей, доступных на этот слот для пробного.
// Использует list_trial_teachers RPC.

import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const querySchema = z.object({
  slot: z.string().datetime({ message: "slot must be ISO datetime" }),
  duration: z.coerce.number().int().min(15).max(180).optional(),
})

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    slot: url.searchParams.get("slot"),
    duration: url.searchParams.get("duration") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Некорректные данные" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("list_trial_teachers", {
    p_slot: parsed.data.slot,
    p_duration: parsed.data.duration ?? 30,
    p_tz: "Europe/Moscow",
  })
  if (error) {
    console.error("[trial-lesson/teachers] rpc error", error)
    return NextResponse.json({ error: "Не удалось получить преподавателей" }, { status: 500 })
  }

  // Нормализуем ответ для UI.
  const teachers = (Array.isArray(data) ? data : []).map((t: any) => ({
    teacherProfileId: t.teacher_profile_id,
    teacherUserId: t.teacher_user_id,
    fullName: t.full_name ?? "Преподаватель",
    avatarUrl: t.avatar_url ?? null,
    rating: typeof t.rating === "number" ? t.rating : Number(t.rating ?? 0),
    totalLessons: t.total_lessons ?? 0,
    totalReviews: t.total_reviews ?? 0,
    experienceYears: t.experience_years ?? null,
    bio: typeof t.bio === "string" ? t.bio.slice(0, 240) : null,
    specializations: Array.isArray(t.specializations) ? t.specializations : [],
  }))

  return NextResponse.json({ teachers })
}
