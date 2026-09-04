import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/booking/teachers — список активных преподов для дропдауна ученика.
// Возвращает teacher_profiles + связанный profile (имя, avatar).
export async function GET() {
  const supabase = await createClient()

  const { data: tps, error: tpErr } = await (supabase as any)
    .from("teacher_profiles")
    .select("id, user_id, hourly_rate")
    .eq("is_listed", true)

  if (tpErr) return NextResponse.json({ error: tpErr.message }, { status: 500 })

  const rows = (tps ?? []) as Array<{ id: string; user_id: string; hourly_rate: number | null }>
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const byId: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds)
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
      byId[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url }
    }
  }

  const teachers = rows.map((r) => ({
    teacherProfileId: r.id,
    userId: r.user_id,
    name: byId[r.user_id]?.full_name ?? "Преподаватель",
    avatarUrl: byId[r.user_id]?.avatar_url ?? null,
    hourlyRate: r.hourly_rate ?? 0,
  }))

  return NextResponse.json({ teachers })
}
