// PATCH /api/admin/leads/[id]/status  { status: 'new' | 'contacted' | 'archived' }
// Admin-only.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { logAuditEvent } from "@/lib/audit/log"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  status: z.enum(["new", "contacted", "archived"]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: "Некорректный id" }, { status: 400 })

    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный статус" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await (admin as any)
      .from("landing_leads")
      .update({ status: parsed.data.status })
      .eq("id", id)
    if (error) {
      console.error("[admin/leads/status] update failed:", error)
      return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 })
    }

    await logAuditEvent(request, {
      category: "admin",
      action: "landing_lead_status_changed",
      target_type: "landing_leads",
      target_id: id,
      payload: { to: parsed.data.status },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("PATCH /api/admin/leads/[id]/status:", err)
    return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 })
  }
}
