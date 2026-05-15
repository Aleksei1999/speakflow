// ============================================================
// GET /api/admin/dashboard
// ------------------------------------------------------------
// Aggregator-эндпоинт для /admin вкладки в TanStack Query.
// Loader'а для админа целиком пока нет — собираем срез из
// уже существующих cached-loader'ов и возвращаем компактный
// summary:
//   - students_summary: top-N students с их прогрессом
//   - clubs_summary: ближайшие клубы (upcoming + draft)
//   - trial_pending: количество teacher_applications в 'new'
//   - teachers_count: total teacher_profiles
//
// Auth: role='admin' (через requireAdmin → 401/403).
// Rate-limit: 60 req / 60s, fail-open (read-only).
// Тяжёлая логика — внутри cached-loader'ов (per-tag), здесь
// просто Promise.all + projection в стабильную form.
// ============================================================
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin-guard"
import {
  getCachedAdminStudents,
  getCachedAdminClubs,
  getCachedAdminTrialRequests,
  getCachedAdminTeachersList,
} from "@/lib/cache/dashboard"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

export type AdminDashboardSnapshot = {
  students_summary: {
    total_recent: number
    rows: Array<{
      id: string
      full_name: string | null
      email: string | null
      avatar_url: string | null
      english_level: string | null
      total_xp: number
      lessons_count: number
      created_at: string
    }>
  }
  clubs_summary: {
    upcoming_count: number
    draft_count: number
    rows: Array<{
      id: string
      title: string
      scheduled_at: string | null
      status: string
      capacity: number
      registered_count: number
      host_teacher_name: string | null
    }>
  }
  trial_pending: number
  teachers_count: number
  generated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      // 401 / 403 — точное распознавание со стороны клиента
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const limited = await enforceRateLimit(request, {
      name: "api:admin-dashboard",
      keyParts: [gate.user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    // Параллельно — каждый loader сам кэширован (unstable_cache + tag).
    const [students, clubsUpcoming, clubsDraft, trialRequests, teachers] =
      await Promise.all([
        getCachedAdminStudents({ limit: 12, sort: "recent" }),
        getCachedAdminClubs({ status: "upcoming", limit: 8 }),
        getCachedAdminClubs({ status: "draft", limit: 4 }),
        getCachedAdminTrialRequests({ status: "new" }),
        getCachedAdminTeachersList({ limit: 500 }),
      ])

    const studentsRows = students.slice(0, 12).map((s) => ({
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      avatar_url: s.avatar_url,
      english_level: s.english_level,
      total_xp: s.total_xp,
      lessons_count: s.lessons_count,
      created_at: s.created_at,
    }))

    const clubsRows = [...clubsUpcoming.clubs, ...clubsDraft.clubs]
      .slice(0, 12)
      .map((c: any) => ({
        id: c.id,
        title: c.title ?? "",
        scheduled_at: c.scheduled_at ?? null,
        status: c.status ?? "draft",
        capacity: c.capacity ?? 0,
        registered_count: c.registered_count ?? 0,
        host_teacher_name: c.host_teacher_name ?? null,
      }))

    const payload: AdminDashboardSnapshot = {
      students_summary: {
        total_recent: students.length,
        rows: studentsRows,
      },
      clubs_summary: {
        upcoming_count: clubsUpcoming.clubs.length,
        draft_count: clubsDraft.clubs.length,
        rows: clubsRows,
      },
      trial_pending: trialRequests.length,
      teachers_count: teachers.length,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(payload, {
      headers: {
        // TanStack Query управляет client-side кэшем — HTTP-кэш
        // конфликтовал бы (разные вкладки видели бы залипшие 200).
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[api/admin/dashboard]", err)
    return NextResponse.json({ error: "failed" }, { status: 500 })
  }
}
