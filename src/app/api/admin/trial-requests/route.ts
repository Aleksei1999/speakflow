// @ts-nocheck
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
          level_test_id, assigned_teacher_id, assigned_lesson_id,
          student:profiles!trial_lesson_requests_user_id_fkey (
            id, full_name, email, phone, avatar_url, english_goal
          ),
          teacher:profiles!trial_lesson_requests_assigned_teacher_id_fkey (
            id, full_name, avatar_url, email
          )
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

    return NextResponse.json({ requests: data ?? [], count: (data ?? []).length })
  } catch (err) {
    console.error("Ошибка в GET /api/admin/trial-requests:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
