// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET /api/admin/teachers?limit=100&search=&sort=rating|recent
// List of teachers (profiles role='teacher' joined with teacher_profiles).
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  search: z.string().trim().max(200).optional().nullable(),
  sort: z.enum(["rating", "recent"]).default("rating"),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные параметры" },
        { status: 400 }
      )
    }
    const { limit, search, sort } = parsed.data

    const admin = createAdminClient()

    let q = admin
      .from("profiles")
      .select(
        `
          id, full_name, first_name, last_name, email, avatar_url,
          phone, is_active, created_at,
          teacher_profiles!teacher_profiles_user_id_fkey (
            id, bio, specializations, experience_years, hourly_rate,
            trial_rate, languages, rating, total_reviews, total_lessons,
            is_verified, is_listed, video_intro_url, updated_at
          )
        `
      )
      .eq("role", "teacher")
      .limit(limit)

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      q = q.or(`full_name.ilike.${term},email.ilike.${term}`)
    }

    const { data: teachers, error } = await q
    if (error) {
      console.error("admin/teachers error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    const rows = (teachers ?? []).map((t: any) => {
      const tp = Array.isArray(t.teacher_profiles)
        ? t.teacher_profiles[0]
        : t.teacher_profiles
      return {
        id: t.id,
        full_name: t.full_name,
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email,
        avatar_url: t.avatar_url,
        phone: t.phone,
        is_active: t.is_active,
        created_at: t.created_at,
        teacher_profile_id: tp?.id ?? null,
        bio: tp?.bio ?? null,
        specializations: tp?.specializations ?? [],
        languages: tp?.languages ?? [],
        experience_years: tp?.experience_years ?? null,
        hourly_rate: tp?.hourly_rate ?? null,
        trial_rate: tp?.trial_rate ?? null,
        rating: tp?.rating ?? 0,
        total_reviews: tp?.total_reviews ?? 0,
        total_lessons: tp?.total_lessons ?? 0,
        is_verified: tp?.is_verified ?? false,
        is_listed: tp?.is_listed ?? false,
      }
    })

    // Sort by rating desc (fallback) or created_at desc.
    if (sort === "rating") {
      rows.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    } else {
      rows.sort((a, b) => {
        const ax = a.created_at ? new Date(a.created_at).getTime() : 0
        const bx = b.created_at ? new Date(b.created_at).getTime() : 0
        return bx - ax
      })
    }

    return NextResponse.json({ teachers: rows, count: rows.length })
  } catch (err) {
    console.error("Ошибка в /api/admin/teachers:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
