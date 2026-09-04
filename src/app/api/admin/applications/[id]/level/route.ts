// PATCH /api/admin/applications/[id]/level
// id: `trial:<uuid>` (заявка ученика) или `lead:<uuid>` (анонимный лид с лендинга).
// Обновляет уровень CEFR:
//   • trial — user_progress.english_level (в roast-формате Well Done итд)
//   • lead  — INSERT в level_tests с email лида и текущим уровнем
// Admin-only.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"
import { CEFR_LEVELS, toRoastLevel, type CefrLevel } from "@/lib/levels/mapping"
import { logAuditEvent } from "@/lib/audit/log"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  level: z.enum(CEFR_LEVELS as unknown as [CefrLevel, ...CefrLevel[]]),
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
    const cefr = parsed.data.level
    const roast = toRoastLevel(cefr)

    const [kind, uuid] = id.split(":", 2)
    const admin = createAdminClient()

    if (kind === "trial") {
      const trialRes = await (admin as any)
        .from("trial_lesson_requests")
        .select("id, user_id")
        .eq("id", uuid)
        .maybeSingle()
      const userId = trialRes.data?.user_id as string | undefined
      if (!userId) {
        return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })
      }
      // upsert user_progress row
      const { error } = await (admin as any)
        .from("user_progress")
        .upsert({ user_id: userId, english_level: roast }, { onConflict: "user_id" })
      if (error) {
        console.error("[admin/applications/level] user_progress upsert error", error)
        return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
      }
    } else if (kind === "lead") {
      const leadRes = await (admin as any)
        .from("landing_leads")
        .select("id, email, name")
        .eq("id", uuid)
        .maybeSingle()
      const email = leadRes.data?.email as string | undefined
      if (!email) {
        return NextResponse.json({ error: "Лид не найден" }, { status: 404 })
      }
      // Пишем «манульную» запись в level_tests, чтобы админский лист сразу
      // показывал новый уровень (у лидов маппинг level по email).
      const { error } = await (admin as any).from("level_tests").insert({
        email,
        level: roast,
        answers: { source: "admin_manual" },
        score: 0, correct_count: 0, total_questions: 0, xp: 0,
        first_name: (leadRes.data?.name as string | undefined)?.split(" ")[0] || null,
      })
      if (error) {
        console.error("[admin/applications/level] level_tests insert error", error)
        return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: "Неизвестный тип заявки" }, { status: 400 })
    }

    await logAuditEvent(request, {
      category: "admin",
      action: "application_level_set",
      target_type: kind === "trial" ? "trial_lesson_requests" : "landing_leads",
      target_id: uuid,
      payload: { cefr, roast },
    })

    return NextResponse.json({ ok: true, level: cefr })
  } catch (err) {
    console.error("PATCH /api/admin/applications/[id]/level error:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
