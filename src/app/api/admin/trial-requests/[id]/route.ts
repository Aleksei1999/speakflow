import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"

// ---------------------------------------------------------------
// PATCH /api/admin/trial-requests/[id]
// Body: { status?, notes?, assigned_teacher_id? }
// Admin-only. Returns the updated row.
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const STATUS_VALUES = ["pending", "assigned", "scheduled", "completed", "cancelled"] as const
const STATUS_ALIAS: Record<string, (typeof STATUS_VALUES)[number]> = {
  new: "pending",
  processing: "assigned",
  matched: "scheduled",
  done: "completed",
}

const bodySchema = z
  .object({
    status: z.string().trim().optional(),
    notes: z.string().trim().max(4000).optional().nullable(),
    assigned_teacher_id: z.string().uuid().optional().nullable(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      d.notes !== undefined ||
      d.assigned_teacher_id !== undefined,
    { message: "Нужно передать хотя бы одно поле" }
  )

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 })
    }

    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const parsed = bodySchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }

    const update: Record<string, any> = {}
    if (parsed.data.status !== undefined) {
      const raw = parsed.data.status.toLowerCase()
      const normalized =
        STATUS_ALIAS[raw] ??
        ((STATUS_VALUES as readonly string[]).includes(raw)
          ? (raw as (typeof STATUS_VALUES)[number])
          : null)
      if (!normalized) {
        return NextResponse.json(
          { error: "Недопустимый статус" },
          { status: 400 }
        )
      }
      update.status = normalized
    }
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes
    if (parsed.data.assigned_teacher_id !== undefined) {
      update.assigned_teacher_id = parsed.data.assigned_teacher_id
    }

    const admin = createAdminClient()
    // FIXME(types): trial_lesson_requests не в Database — нужен typegen
    const { data, error } = await (admin.from("trial_lesson_requests") as any)
      .update(update)
      .eq("id", id)
      .select(
        `
          id, status, notes, created_at, updated_at,
          level_test_id, assigned_teacher_id, assigned_lesson_id
        `
      )
      .maybeSingle()

    if (error) {
      console.error("PATCH admin/trial-requests error:", error)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    }

    // Audit: ручное вмешательство админа в заявку на пробный урок.
    await logAuditEvent(request, {
      category: 'admin',
      action: update.status
        ? `trial_request_status_${update.status}`
        : 'trial_request_updated',
      target_type: 'trial_lesson_requests',
      target_id: id,
      payload: {
        status: update.status ?? null,
        assigned_teacher_id: update.assigned_teacher_id ?? null,
        notes_changed: parsed.data.notes !== undefined,
      },
    })

    return NextResponse.json({ request: data })
  } catch (err) {
    console.error("Ошибка в PATCH /api/admin/trial-requests/[id]:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
