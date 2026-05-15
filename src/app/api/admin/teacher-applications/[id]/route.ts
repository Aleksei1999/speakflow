import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  status: z
    .enum(["new", "in_review", "approved", "rejected", "archived"])
    .optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

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
    const parsed = patchSchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }

    const update: Record<string, any> = {}
    if (parsed.data.status !== undefined) {
      update.status = parsed.data.status
      update.reviewed_by = gate.user.id
      update.reviewed_at = new Date().toISOString()
    }
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Нечего обновлять" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    // FIXME(types): teacher_applications не в Database — нужен typegen
    const { data, error } = await (admin.from("teacher_applications") as any)
      .update(update)
      .eq("id", id)
      .select(
        "id, first_name, last_name, email, contact, notes, status, reviewed_by, reviewed_at, created_at, updated_at"
      )
      .maybeSingle()
    if (error) {
      console.error("PATCH teacher-applications error:", error)
      return NextResponse.json({ error: "Ошибка БД" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    }

    // Audit: ручное изменение статуса/заметок заявки. status_changed
    // отдельная action — чтобы фильтровать reject/archive отдельно от
    // generic update.
    await logAuditEvent(request, {
      category: 'admin',
      action: parsed.data.status
        ? `teacher_application_status_${parsed.data.status}`
        : 'teacher_application_updated',
      target_type: 'teacher_applications',
      target_id: id,
      payload: {
        status: parsed.data.status ?? null,
        notes_changed: parsed.data.notes !== undefined,
      },
    })

    return NextResponse.json({ application: data })
  } catch (err) {
    console.error("PATCH /api/admin/teacher-applications/[id]:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}
