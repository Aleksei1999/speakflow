// GET/PATCH /api/admin/rates
// Глобальные тарифы учителей (единые для всех). Только admin.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { fetchTeacherRates } from "@/lib/settings/rates"

export const dynamic = "force-dynamic"

export async function GET() {
  const rates = await fetchTeacherRates()
  return NextResponse.json({ rates })
}

const bodySchema = z.object({
  rate60Kopecks: z.number().int().min(0).max(1_000_000_00).optional(),
  rate90Kopecks: z.number().int().min(0).max(1_000_000_00).optional(),
  rateGroupKopecks: z.number().int().min(0).max(1_000_000_00).optional(),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let body: unknown
  try { body = await request.json() } catch { body = {} }
  const parsed = bodySchema.safeParse(body || {})
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Некорректные данные" }, { status: 400 })
  }

  const updates: Array<{ key: string; value: number }> = []
  if (parsed.data.rate60Kopecks !== undefined) updates.push({ key: "teacher_rate_60_kopecks", value: parsed.data.rate60Kopecks })
  if (parsed.data.rate90Kopecks !== undefined) updates.push({ key: "teacher_rate_90_kopecks", value: parsed.data.rate90Kopecks })
  if (parsed.data.rateGroupKopecks !== undefined) updates.push({ key: "teacher_rate_group_kopecks", value: parsed.data.rateGroupKopecks })

  if (updates.length === 0) {
    return NextResponse.json({ error: "Ничего не изменилось" }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient() as any
  for (const u of updates) {
    await admin.from("app_settings").upsert({
      key: u.key,
      value: u.value,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: "key" })
  }

  const rates = await fetchTeacherRates()
  return NextResponse.json({ ok: true, rates })
}
