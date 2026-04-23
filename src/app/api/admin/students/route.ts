// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET /api/admin/students?limit=100&search=&sort=recent|name
// List of students for admin grid with basic XP + lesson totals.
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  search: z.string().trim().max(200).optional().nullable(),
  sort: z.enum(["recent", "name"]).default("recent"),
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
          phone, english_goal, city, occupation, created_at,
          subscription_tier, subscription_until,
          user_progress:user_progress!user_progress_user_id_fkey (
            total_xp, current_level, lessons_completed, current_streak,
            english_level, updated_at
          )
        `
      )
      .eq("role", "student")
      .limit(limit)

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      q = q.or(`full_name.ilike.${term},email.ilike.${term}`)
    }

    if (sort === "name") {
      q = q.order("full_name", { ascending: true })
    } else {
      q = q.order("created_at", { ascending: false })
    }

    const { data: students, error } = await q
    if (error) {
      console.error("admin/students error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    const rows = (students ?? []).map((s: any) => {
      const up = Array.isArray(s.user_progress) ? s.user_progress[0] : s.user_progress
      return {
        id: s.id,
        full_name: s.full_name,
        first_name: s.first_name,
        last_name: s.last_name,
        email: s.email,
        avatar_url: s.avatar_url,
        phone: s.phone,
        english_level: up?.english_level ?? null,
        english_goal: s.english_goal,
        city: s.city,
        occupation: s.occupation,
        created_at: s.created_at,
        last_seen_at: up?.updated_at ?? null,
        total_xp: up?.total_xp ?? 0,
        current_level: up?.current_level ?? 1,
        lessons_count: up?.lessons_completed ?? 0,
        current_streak: up?.current_streak ?? 0,
        subscription_tier: s.subscription_tier ?? "free",
        subscription_until: s.subscription_until ?? null,
      }
    })

    return NextResponse.json({ students: rows, count: rows.length })
  } catch (err) {
    console.error("Ошибка в /api/admin/students:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
