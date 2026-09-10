import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET /api/admin/trial-requests?limit=50&status=pending|assigned|scheduled|completed|cancelled
//
// Lists trial lesson requests (newest first) with the linked student and
// any assigned teacher for quick triage on admin UI.
// Status param maps to the trial_lesson_requests.status enum:
//   'pending' | 'assigned' | 'scheduled' | 'completed' | 'cancelled'
// (the legacy fronted alias 'new' maps to 'pending', 'processing'→'assigned',
// 'matched'→'scheduled', 'done'→'completed'.)
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const STATUS_VALUES = ["pending", "assigned", "scheduled", "completed", "cancelled"] as const
const STATUS_ALIAS: Record<string, (typeof STATUS_VALUES)[number]> = {
  new: "pending",
  processing: "assigned",
  matched: "scheduled",
  done: "completed",
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.string().trim().optional().nullable(),
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
      status: searchParams.get("status") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные параметры" },
        { status: 400 }
      )
    }
    const { limit } = parsed.data
    const rawStatus = parsed.data.status?.toLowerCase() ?? null
    const normalized = rawStatus
      ? STATUS_ALIAS[rawStatus] ?? (STATUS_VALUES as readonly string[]).includes(rawStatus)
        ? (STATUS_ALIAS[rawStatus] ?? (rawStatus as (typeof STATUS_VALUES)[number]))
        : null
      : null

    const admin = createAdminClient()

    let q = admin
      .from("trial_lesson_requests")
      .select(
        `
          id, status, notes, created_at, updated_at,
          level_test_id, assigned_teacher_id, assigned_lesson_id, user_id
        `
      )
      .order("created_at", { ascending: false })
      .limit(limit)

    if (normalized) {
      q = q.eq("status", normalized)
    }

    const { data, error } = await q
    if (error) {
      console.error("admin/trial-requests error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }

    // PostgREST-embed через FK не работает (user_id → auth.users, assigned_teacher_id → teacher_profiles),
    // поэтому student/teacher (profiles) подтягиваем отдельными запросами.
    const rows = (data ?? []) as any[]
    const tpIds = Array.from(new Set(rows.map((r) => r.assigned_teacher_id).filter(Boolean)))
    const { data: tps } = tpIds.length
      ? await admin.from("teacher_profiles").select("id, user_id").in("id", tpIds)
      : { data: [] as any[] }
    const tpUserById = new Map((tps ?? []).map((t: any) => [t.id, t.user_id]))
    const profileIds = Array.from(new Set([...rows.map((r) => r.user_id), ...Array.from(tpUserById.values())].filter(Boolean)))
    const { data: profiles } = profileIds.length
      ? await admin.from("profiles").select("id, full_name, email, phone, avatar_url, english_goal").in("id", profileIds)
      : { data: [] as any[] }
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    const requests = rows.map((r) => {
      const s = byId.get(r.user_id)
      const t = r.assigned_teacher_id ? byId.get(tpUserById.get(r.assigned_teacher_id)) : null
      return {
        ...r,
        student: s ? { id: s.id, full_name: s.full_name, email: s.email, phone: s.phone, avatar_url: s.avatar_url, english_goal: s.english_goal } : null,
        teacher: t ? { id: t.id, full_name: t.full_name, avatar_url: t.avatar_url, email: t.email } : null,
      }
    })
    return NextResponse.json({ requests, count: requests.length })
  } catch (err) {
    console.error("Ошибка в GET /api/admin/trial-requests:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
