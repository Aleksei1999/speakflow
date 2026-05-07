// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ---------------------------------------------------------------------------
// GET /api/teacher/profile/me
// Сводка по teacher-профилю: общий profiles + teacher_profiles.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 })
    }

    const [profileRes, tpRes, statsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, first_name, last_name, full_name, avatar_url, phone, timezone, city, role, created_at"
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("teacher_profiles")
        .select(
          "id, bio, specializations, experience_years, hourly_rate, trial_rate, languages, education, certificates, video_intro_url, rating, total_reviews, total_lessons, is_verified, is_listed"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      // считаем completed уроков как «реальный» total_lessons (на счётчик в teacher_profiles полагаться нельзя)
      supabase
        .from("lessons")
        .select("id, status, duration_minutes", { count: "exact", head: false })
        .eq("status", "completed"),
    ])

    if (profileRes.error) {
      return NextResponse.json({ error: "Не удалось загрузить профиль" }, { status: 500 })
    }
    const profile = profileRes.data
    if (!profile || profile.role !== "teacher") {
      return NextResponse.json({ error: "Доступ только для преподавателей" }, { status: 403 })
    }
    const teacherProfile = tpRes.data ?? null

    // Уточнённый total_lessons именно по teacher_id текущего препода
    let realCompleted = 0
    let realHours = 0
    if (teacherProfile?.id) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("duration_minutes, status")
        .eq("teacher_id", teacherProfile.id)
        .eq("status", "completed")
      for (const l of (lessons ?? []) as Array<{ duration_minutes: number | null; status: string }>) {
        realCompleted += 1
        realHours += (l.duration_minutes ?? 0) / 60
      }
    }

    return NextResponse.json({
      profile,
      teacher: teacherProfile,
      stats: {
        completed_lessons: realCompleted,
        total_hours: Math.round(realHours * 10) / 10,
        rating: teacherProfile?.rating ?? 0,
        total_reviews: teacherProfile?.total_reviews ?? 0,
        is_verified: teacherProfile?.is_verified ?? false,
        is_listed: teacherProfile?.is_listed ?? false,
      },
    })
  } catch (e) {
    console.error("[GET /api/teacher/profile/me] crashed:", e)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/teacher/profile/me
// Частичное обновление общих полей profile + teacher_profiles. Безопасно: id,
// email, role, рейтинги, total_lessons и пр. админ-поля сюда не попадают.
// ---------------------------------------------------------------------------

const PatchSchema = z.object({
  // Общий профиль
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  timezone: z.string().trim().max(80).optional(),
  avatar_url: z.string().url().nullable().optional(),

  // Преподавательский профиль
  bio: z.string().trim().max(2000).optional(),
  specializations: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  experience_years: z.number().int().min(0).max(70).optional(),
  hourly_rate: z.number().int().min(0).max(50_000_000).optional(), // в копейках
  trial_rate: z.number().int().min(0).max(50_000_000).nullable().optional(),
  languages: z.array(z.string().trim().min(2).max(8)).max(10).optional(),
  education: z.string().trim().max(1000).optional(),
  certificates: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  video_intro_url: z.string().url().nullable().optional(),
  is_listed: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Необходимо авторизоваться" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Проверим, что пользователь — учитель
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle()
    if (!prof || prof.role !== "teacher") {
      return NextResponse.json({ error: "Доступ только для преподавателей" }, { status: 403 })
    }

    // Profile-level полей
    const profilePatch: Record<string, any> = {}
    if (data.first_name !== undefined) profilePatch.first_name = data.first_name
    if (data.last_name !== undefined) profilePatch.last_name = data.last_name
    if (data.phone !== undefined) profilePatch.phone = data.phone
    if (data.city !== undefined) profilePatch.city = data.city
    if (data.timezone !== undefined) profilePatch.timezone = data.timezone
    if (data.avatar_url !== undefined) profilePatch.avatar_url = data.avatar_url
    if (data.first_name !== undefined || data.last_name !== undefined) {
      const fn = (data.first_name ?? prof.first_name ?? "").trim()
      const ln = (data.last_name ?? prof.last_name ?? "").trim()
      const full = [fn, ln].filter(Boolean).join(" ")
      if (full) profilePatch.full_name = full
    }
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase.from("profiles").update(profilePatch).eq("id", user.id)
      if (error) {
        console.error("[PATCH teacher profile] profile update failed:", error)
        return NextResponse.json({ error: "Не удалось сохранить профиль" }, { status: 500 })
      }
    }

    // Teacher-level поля
    const tpPatch: Record<string, any> = {}
    if (data.bio !== undefined) tpPatch.bio = data.bio
    if (data.specializations !== undefined) tpPatch.specializations = data.specializations
    if (data.experience_years !== undefined) tpPatch.experience_years = data.experience_years
    if (data.hourly_rate !== undefined) tpPatch.hourly_rate = data.hourly_rate
    if (data.trial_rate !== undefined) tpPatch.trial_rate = data.trial_rate
    if (data.languages !== undefined) tpPatch.languages = data.languages
    if (data.education !== undefined) tpPatch.education = data.education
    if (data.certificates !== undefined) tpPatch.certificates = data.certificates
    if (data.video_intro_url !== undefined) tpPatch.video_intro_url = data.video_intro_url
    if (data.is_listed !== undefined) tpPatch.is_listed = data.is_listed

    if (Object.keys(tpPatch).length > 0) {
      const { error } = await supabase
        .from("teacher_profiles")
        .update(tpPatch)
        .eq("user_id", user.id)
      if (error) {
        console.error("[PATCH teacher profile] teacher_profiles update failed:", error)
        return NextResponse.json({ error: "Не удалось сохранить преподавательские данные" }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[PATCH /api/teacher/profile/me] crashed:", e)
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 })
  }
}
