// @ts-nocheck
// POST /api/trial-lesson/request
// Called after signup. Creates a trial_lesson_requests row and notifies admins
// via Telegram. Idempotent: one pending request per user.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram/bot'

const bodySchema = z.object({
  levelTestId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }

  // Dedupe pending requests per user
  const { data: existing } = await supabase
    .from('trial_lesson_requests')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['pending', 'assigned', 'scheduled'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, reused: true })
  }

  const { data: inserted, error } = await supabase
    .from('trial_lesson_requests')
    .insert({
      user_id: user.id,
      level_test_id: parsed.data.levelTestId ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[trial-lesson/request] insert failed:', error)
    return NextResponse.json({ error: 'Не удалось создать заявку' }, { status: 500 })
  }

  // Fire-and-forget admin notification
  void notifyAdmins(user.id, inserted.id).catch((err) => {
    console.error('[trial-lesson/request] notify failed:', err)
  })

  return NextResponse.json({ id: inserted.id, reused: false })
}

async function notifyAdmins(userId: string, requestId: string) {
  const supabase = await createClient()

  const [{ data: profile }, { data: admins }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('role', 'admin')
      .not('telegram_chat_id', 'is', null),
  ])

  if (!profile || !admins || admins.length === 0) return

  const text =
    `🎙 <b>Новая заявка на пробное занятие</b>\n\n` +
    `<b>${profile.full_name || '—'}</b>\n` +
    `📧 ${profile.email}\n` +
    (profile.phone ? `📱 ${profile.phone}\n` : '') +
    `\n<code>${requestId}</code>`

  await Promise.all(
    admins
      .filter((a): a is { telegram_chat_id: number } => !!a.telegram_chat_id)
      .map((a) =>
        sendTelegramMessage({
          chatId: a.telegram_chat_id,
          text,
          parseMode: 'HTML',
        }).catch(() => {})
      )
  )
}
