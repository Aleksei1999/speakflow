// POST /api/landing/lead
// Public endpoint для landing-формы «Оставь свои данные».
// Пишет в landing_leads (service-role → bypass RLS), нотифицирует админов в Telegram.
//
// Защита: Arcjet (shield + bot) + rate-limit IP + email-валидация Arcjet + email-rate-limit + dedup 5min.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"
import { protectPublic, validateEmailField } from "@/lib/api/arcjet"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1, "Укажи имя").max(100),
  email: z.string().trim().email("Некорректный email").max(200),
  phone: z.string().trim().min(6, "Некорректный номер телефона").max(40),
  marketing_opt_in: z.boolean().optional().default(false),
  country: z.string().trim().length(2).optional(),
  source: z.string().trim().max(50).optional().default("landing"),
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

    const { data: lead, error } = (await (admin as any)
      .from("landing_leads")
      .insert({
        name: d.name,
        email: d.email,
        phone: d.phone,
        marketing_opt_in: d.marketing_opt_in ?? false,
        source: d.source ?? "landing",
        country: d.country ?? null,
        ip,
        user_agent: userAgent,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: any }

    if (error || !lead) {
      console.error("[landing/lead] insert error:", error)
      return NextResponse.json({ error: "Не удалось сохранить заявку" }, { status: 500 })
    }

    // Telegram fan-out to admins (fire-and-forget)
    void notifyAdmins({ leadId: lead.id, data: d }).catch(() => {})

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
    `\n<i>id: ${args.leadId}</i>`

  await Promise.allSettled(
    (admins as { telegram_chat_id: string | null }[])
      .filter((a) => a.telegram_chat_id)
      .map((a) =>
        sendTelegramMessage({
          chatId: a.telegram_chat_id!,
          text,
          parseMode: "HTML",
        }).catch(() => {})
      )
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  )
}
