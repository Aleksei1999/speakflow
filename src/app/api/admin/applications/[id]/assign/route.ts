// PATCH /api/admin/applications/[id]/assign
// id: `trial:<uuid>` — назначает учителя (trial_lesson_requests.assigned_teacher_id + status='assigned').
// id: `lead:<uuid>`  — 409, лида нельзя назначить до регистрации.
// Admin-only.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  teacherId: z.string().uuid(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || !id.includes(":")) {
      return NextResponse.json({ error: "Некорректный id заявки" }, { status: 400 })
    }
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    let body: unknown
    try { body = await request.json() } catch { body = {} }
    const parsed = bodySchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Некорректные данные" }, { status: 400 })
    }
    const teacherId = parsed.data.teacherId

    const [kind, uuid] = id.split(":", 2)
    const admin = createAdminClient()

    let data: any = null
    if (kind === "trial") {
      const res = await (admin.from("trial_lesson_requests") as any)
        .update({ assigned_teacher_id: teacherId, status: "assigned" })
        .eq("id", uuid)
        .select("id, status, assigned_teacher_id, user_id")
        .maybeSingle()
      if (res.error) {
        console.error("[admin/applications/assign] trial update error", res.error)
        return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
      }
      data = res.data
    } else if (kind === "lead") {
      // Не меняем status — чтобы лид не выпал из фильтра ["new","contacted"]
      // в списке /admin. Достаточно записать assigned_teacher_id.
      const res = await ((admin as any).from("landing_leads"))
        .update({ assigned_teacher_id: teacherId })
        .eq("id", uuid)
        .select("id, status, assigned_teacher_id, email")
        .maybeSingle()
      if (res.error) {
        console.error("[admin/applications/assign] lead update error", res.error)
        return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
      }
      data = res.data
    } else {
      return NextResponse.json({ error: "Неизвестный тип заявки" }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
    }

    await logAuditEvent(request, {
      category: "admin",
      action: kind === "trial" ? "trial_request_assigned" : "landing_lead_assigned",
      target_type: kind === "trial" ? "trial_lesson_requests" : "landing_leads",
      target_id: uuid,
      payload: { teacher_id: teacherId },
    })

    return NextResponse.json({ ok: true, request: data })
  } catch (err) {
    console.error("PATCH /api/admin/applications/[id]/assign error:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
