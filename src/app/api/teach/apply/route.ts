// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"
import { transliterateRu } from "@/lib/transliterate"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  first_name: z.string().trim().min(1, "Укажи имя").max(100),
  last_name: z.string().trim().min(1, "Укажи фамилию").max(100),
  email: z.string().trim().email("Некорректный email").max(200),
  contact: z.string().trim().min(1, "Укажи Telegram или телефон").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    let body: any
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
    const d = parsed.data

    const admin = createAdminClient()

    // Простая антиспам-дедупликация: тот же email за последние 5 минут.
    const { data: dup } = await admin
      .from("teacher_applications")
      .select("id, created_at")
      .eq("email", d.email)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .maybeSingle()
    if (dup) {
      return NextResponse.json({ ok: true, duplicate: true, id: dup.id })
    }

    // Latinize incoming Cyrillic names so the rendered teacher card uses the
    // Gluten cursive font (designed for Latin glyphs). Original is kept in
    // notes-prefix so admins can still see what the teacher actually typed.
    const firstLatin = transliterateRu(d.first_name)
    const lastLatin = transliterateRu(d.last_name)

    const { data: app, error } = await admin
      .from("teacher_applications")
      .insert({
        first_name: firstLatin,
        last_name: lastLatin,
        email: d.email,
        contact: d.contact,
        notes: d.notes ?? null,
      })
      .select("id, created_at")
      .single()

    if (error || !app) {
      console.error("[teach/apply] insert error:", error)
      return NextResponse.json(
        { error: "Не удалось сохранить заявку" },
        { status: 500 }
      )
    }

    // Telegram fan-out to admins (fire-and-forget). Show admins the *latinized*
    // name (matches what they'll see in /admin/teacher-applications and the
    // future teacher card), but include the original Cyrillic in parens for
    // disambiguation.
    void notifyAdmins({
      applicationId: app.id,
      data: {
        ...d,
        first_name: firstLatin,
        last_name: lastLatin,
        original_first_name: d.first_name,
        original_last_name: d.last_name,
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true, id: app.id })
  } catch (err) {
    console.error("POST /api/teach/apply error:", err)
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    )
  }
}

async function notifyAdmins(args: {
  applicationId: string
  data: {
    first_name: string
    last_name: string
    email: string
    contact: string
    notes?: string | null
    original_first_name?: string
    original_last_name?: string
  }
}) {
  const admin = createAdminClient()
  const { data: admins } = await admin
    .from("profiles")
    .select("telegram_chat_id")
    .eq("role", "admin")
    .not("telegram_chat_id", "is", null)
  if (!admins || admins.length === 0) return

  const fullName = `${args.data.first_name} ${args.data.last_name}`.trim()
  const originalFull =
    `${args.data.original_first_name ?? ""} ${args.data.original_last_name ?? ""}`.trim()
  const showOriginal =
    originalFull && originalFull.toLowerCase() !== fullName.toLowerCase()
  const text =
    `🧑‍🏫 <b>Новая заявка от преподавателя</b>\n\n` +
    `<b>${fullName}</b>` +
    (showOriginal ? ` <i>(${originalFull})</i>` : "") +
    `\n📧 ${args.data.email}\n` +
    `📱 ${args.data.contact}\n` +
    (args.data.notes ? `\n💬 ${args.data.notes}\n` : "") +
    `\n<code>${args.applicationId}</code>`

  await Promise.all(
    admins
      .filter((a: any) => !!a.telegram_chat_id)
      .map((a: any) =>
        sendTelegramMessage({
          chatId: a.telegram_chat_id as number,
          text,
          parseMode: "HTML",
        }).catch(() => {})
      )
  )
}
