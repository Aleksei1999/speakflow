// POST /api/landing/lead
// Public endpoint для landing-формы «Оставь свои данные».
// Пишет в landing_leads (service-role → bypass RLS), нотифицирует админов в Telegram.
//
// Защита: Arcjet (shield + bot) + rate-limit IP + email-валидация Arcjet + email-rate-limit + dedup 5min.

import { APPLICATIONS_TELEGRAM } from "@/lib/notifications/flags"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"
import { protectPublic, validateEmailField } from "@/lib/api/arcjet"
import { emailSchema, phoneIntlSchema } from "@/lib/validators/contact"
import { escapeHtml } from "@/lib/html/escape"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1, "Укажи имя").max(100),
  email: emailSchema,
  phone: phoneIntlSchema,
  marketing_opt_in: z.boolean().optional().default(false),
  comment: z.string().trim().max(1000).optional(),
  country: z.string().trim().length(2).optional(),
  source: z.string().trim().max(50).optional().default("landing"),
  // Опциональный результат «Прожарки» с лендинга — сохраняем в level_tests
  // с этим же email, чтобы админ у заявки увидел тег «тест пройден».
  // log[] — детальный разбор ответов, админка рендерит его в развёрнутой карточке.
  roast_quiz: z
    .object({
      level: z.enum(["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"]),
      tierScores: z.tuple([z.number().int().min(0).max(4), z.number().int().min(0).max(4), z.number().int().min(0).max(4)]),
      log: z
        .array(
          z.object({
            text: z.string().max(300),
            options: z.array(z.string().max(120)).min(2).max(6),
            chosen: z.number().int().min(0).max(5),
            correct: z.number().int().min(0).max(5),
            lvl: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
          }),
        )
        .max(20)
        .optional(),
    })
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Arcjet: shield + bot detection
    const ajDeny = await protectPublic(request)
    if (ajDeny) return ajDeny

    // IP rate-limit: 3 заявки в час
    const ipLimited = await enforceRateLimitStrict(request, {
      name: "landing:lead:ip",
      keyParts: [getClientIp(request)],
      max: 3,
      windowSeconds: 60 * 60,
    })
    if (ipLimited) return ipLimited

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {}

    const parsed = bodySchema.safeParse(body || {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      )
    }
    const d = parsed.data

    // Email-валидация через Arcjet (disposable / MX)
    const emailCheck = await validateEmailField(d.email)
    if (!emailCheck.valid) {
      const msg =
        emailCheck.reason === "disposable"
          ? "Укажите личный email, а не одноразовый"
          : emailCheck.reason === "no_mx"
            ? "Домен этого email не принимает почту"
            : "Некорректный email"
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Email rate-limit: 1 заявка в 10 минут
    const emailLimited = await enforceRateLimitStrict(request, {
      name: "landing:lead:email",
      keyParts: [d.email.toLowerCase()],
      max: 1,
      windowSeconds: 60 * 10,
    })
    if (emailLimited) return emailLimited

    const admin = createAdminClient()

    // Dedup: тот же email за последние 5 минут — тихо возвращаем ok
    const { data: dup } = (await (admin as any)
      .from("landing_leads")
      .select("id, created_at")
      .eq("email", d.email)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .maybeSingle()) as { data: { id: string; created_at: string } | null }
    if (dup) {
      return NextResponse.json({ ok: true, duplicate: true, id: dup.id })
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null
    const ip = getClientIp(request)

    const row = {
      name: d.name,
      email: d.email,
      phone: d.phone,
      marketing_opt_in: d.marketing_opt_in ?? false,
      source: d.source ?? "landing",
      country: d.country ?? null,
      ip,
      user_agent: userAgent,
    }
    const insertLead = (withComment: boolean) =>
      (admin as any)
        .from("landing_leads")
        .insert(withComment ? { ...row, comment: d.comment || null } : row)
        .select("id")
        .single() as Promise<{ data: { id: string } | null; error: { code?: string; message?: string } | null }>

    let { data: lead, error } = await insertLead(true)
    // Страховка на период до применения миграции 20260907220000 (колонка comment):
    // если колонки ещё нет — пишем лид без комментария, а не теряем заявку.
    if (error && /comment/i.test(String(error.message ?? "")) && (error.code === "42703" || error.code === "PGRST204")) {
      console.error("[landing/lead] no `comment` column yet — retry without it:", error.message)
      ;({ data: lead, error } = await insertLead(false))
    }

    if (error || !lead) {
      console.error("[landing/lead] insert error:", error)
      return NextResponse.json({ error: "Не удалось сохранить заявку" }, { status: 500 })
    }

    // Прикрепляем результат квиза «Прожарка» к email — insert-if-absent.
    // Fire-and-forget: ошибка не должна ронять форму. Дедуп по email за 24ч,
    // чтобы повторные заявки не плодили дубли в level_tests.
    if (d.roast_quiz) {
      void (async () => {
        try {
          const { data: existing } = await (admin as any)
            .from("level_tests")
            .select("id")
            .eq("email", d.email)
            .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle()
          if (existing) return
          const scores = d.roast_quiz!.tierScores
          const score = scores[0] + scores[1] + scores[2]
          const log = d.roast_quiz!.log
          await (admin as any).from("level_tests").insert({
            email: d.email,
            level: d.roast_quiz!.level,
            answers: { source: "roast_quiz", tierScores: scores, ...(log ? { log } : {}) },
            score,
            correct_count: score,
            total_questions: 12,
            xp: 0,
            first_name: d.name.split(" ")[0] || null,
          })
        } catch (e) {
          console.error("[landing/lead] roast_quiz insert failed", e)
        }
      })()
    }

    // Telegram fan-out to admins (fire-and-forget)
    if (APPLICATIONS_TELEGRAM) void notifyAdmins({ leadId: lead.id, data: d }).catch((e) => console.warn("[landing/lead]", e))

    return NextResponse.json({ ok: true, id: lead.id })
  } catch (err) {
    console.error("POST /api/landing/lead error:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}

async function notifyAdmins(args: {
  leadId: string
  data: {
    name: string
    email: string
    phone: string
    marketing_opt_in?: boolean
    comment?: string
    country?: string
    source?: string
  }
}) {
  const admin = createAdminClient()
  const { data: admins } = await admin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("role", "admin")
    .not("telegram_chat_id", "is", null)
  if (!admins || admins.length === 0) return

  const text =
    `📨 <b>Новая заявка с лендинга</b>\n\n` +
    `👤 <b>${escapeHtml(args.data.name)}</b>\n` +
    `📧 ${escapeHtml(args.data.email)}\n` +
    `📱 ${escapeHtml(args.data.phone)}\n` +
    (args.data.country ? `🌍 ${escapeHtml(args.data.country)}\n` : ``) +
    (args.data.marketing_opt_in ? `✅ согласен на маркетинг\n` : ``) +
    (args.data.comment ? `💬 ${escapeHtml(args.data.comment)}\n` : ``) +
    `\n<i>id: ${args.leadId}</i>`

  await Promise.allSettled(
    (admins as { telegram_chat_id: string | null }[])
      .filter((a) => a.telegram_chat_id)
      .map((a) =>
        sendTelegramMessage({
          chatId: a.telegram_chat_id!,
          text,
          parseMode: "HTML",
        }).catch((e) => console.warn("[landing/lead]", e))
      )
  )
}
