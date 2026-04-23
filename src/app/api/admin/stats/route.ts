// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET /api/admin/stats
// Returns summary counters + 7-day signup sparkline for admin dash.
//
// Response shape:
//   {
//     students_active: number,   // students active last 30d (by created_at fallback)
//     apps_today: number,        // trial_lesson_requests created today
//     lessons_today: number,     // lessons scheduled today in any non-cancelled state
//     live_now: number,          // lessons.status='in_progress'
//     open_tickets: number,      // support_threads where status in ('open','pending')
//     signups_week: number[7]    // new profiles per day, 7 entries (today last)
//   }
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

function startOfUtcDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const admin = createAdminClient()
    const now = new Date()
    const todayStart = startOfUtcDay(now).toISOString()
    const todayEnd = new Date(startOfUtcDay(now).getTime() + 24 * 60 * 60 * 1000).toISOString()

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgoStart = startOfUtcDay(
      new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    )

    // Run counters in parallel.
    const [
      studentsActiveRes,
      appsTodayRes,
      lessonsTodayRes,
      liveNowRes,
      openTicketsRes,
      signupsRes,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .gte("created_at", thirtyDaysAgo),
      admin
        .from("trial_lesson_requests")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd),
      admin
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_at", todayStart)
        .lt("scheduled_at", todayEnd)
        .not("status", "in", "(cancelled,no_show)"),
      admin
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      admin
        .from("support_threads")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "pending"]),
      admin
        .from("profiles")
        .select("created_at")
        .gte("created_at", sevenDaysAgoStart.toISOString())
        .limit(5000),
    ])

    // Bucket signups into 7 daily counts.
    const signupsWeek: number[] = Array(7).fill(0)
    const rows = signupsRes.data ?? []
    for (const r of rows) {
      if (!r?.created_at) continue
      const d = new Date(r.created_at)
      const dayDiff = Math.floor(
        (startOfUtcDay(d).getTime() - sevenDaysAgoStart.getTime()) /
          (24 * 60 * 60 * 1000)
      )
      if (dayDiff >= 0 && dayDiff < 7) {
        signupsWeek[dayDiff]++
      }
    }

    return NextResponse.json({
      students_active: studentsActiveRes.count ?? 0,
      apps_today: appsTodayRes.count ?? 0,
      lessons_today: lessonsTodayRes.count ?? 0,
      live_now: liveNowRes.count ?? 0,
      open_tickets: openTicketsRes.count ?? 0,
      signups_week: signupsWeek,
    })
  } catch (err) {
    console.error("Ошибка в /api/admin/stats:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
