// @ts-nocheck
// ---------------------------------------------------------------------------
// POST /api/balance/topup/create
//
// Тело: { amountRub: number, phone: string }
//   amountRub — целое число рублей (min 100, max 100_000).
//   phone     — телефон плательщика (для receipt). Свободный формат,
//               нормализуем в +7\d{10}.
// Email  берётся из profiles.email (fallback: auth.user.email).
//
// Flow:
//   1) auth + rate-limit + валидация
//   2) INSERT balance_topups (status='pending', id генерируется БД)
//   3) YooKassa createPayment с metadata { topup_id, user_id, kind: 'balance' }
//   4) UPDATE topup.yookassa_payment_id
//   5) return { confirmationUrl }
//
// Вебхук /api/payments/webhook по kind='balance' сам зачислит средства.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getYooKassaClient } from '@/lib/yookassa/client'
import { YooKassaError } from '@/lib/yookassa/types'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { logAuditEvent } from '@/lib/audit/log'
import { normalizePhoneRu, isValidEmail } from '@/lib/validators/contact'

const MIN_AMOUNT_RUB = 100
const MAX_AMOUNT_RUB = 100_000

const bodySchema = z.object({
  amountRub: z
    .number()
    .int('Сумма должна быть целым числом рублей')
    .min(MIN_AMOUNT_RUB, `Минимум ${MIN_AMOUNT_RUB} ₽`)
    .max(MAX_AMOUNT_RUB, `Максимум ${MAX_AMOUNT_RUB.toLocaleString('ru-RU')} ₽`),
  phone: z.string().min(5, 'Введите номер телефона').max(30),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
    }

    // Rate-limit: 5 попыток пополнения в минуту.
    const limited = await enforceRateLimitStrict(request, {
      name: 'balance:topup:create',
      keyParts: [user.id, getClientIp(request)],
      max: 5,
      windowSeconds: 60,
    })
    if (limited) return limited

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      )
    }

    const { amountRub, phone } = parsed.data
    const normalizedPhone = normalizePhoneRu(phone)
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Некорректный номер телефона' }, { status: 400 })
    }

    // Email — из профиля, fallback на auth user email.
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .maybeSingle<{ email: string | null }>()
    const email = profile?.email || user.email || null
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'В профиле не указан корректный email — заполните его перед пополнением' },
        { status: 400 }
      )
    }

    const amountKopecks = amountRub * 100

    // Insert topup FIRST — получаем id, который используем как idempotency key.
    const admin = createAdminClient() as any
    const insertRes = await admin
      .from('balance_topups')
      .insert({
        user_id: user.id,
        amount_kopecks: amountKopecks,
        currency: 'RUB',
        phone: normalizedPhone,
        email,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insertRes.error || !insertRes.data) {
      console.error('[balance/topup] insert failed', insertRes.error)
      return NextResponse.json({ error: 'Не удалось создать заявку' }, { status: 500 })
    }
    const topupId = insertRes.data.id as string

    // YooKassa createPayment.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://speakflow.ru'
    const yookassa = getYooKassaClient()
    let ykPayment: Awaited<ReturnType<typeof yookassa.createPayment>>
    try {
      ykPayment = await yookassa.createPayment({
        amountKopecks,
        description: `Пополнение баланса Raw English (${amountRub} ₽)`,
        returnUrl: `${siteUrl}/student?topup=return`,
        metadata: {
          topup_id: topupId,
          user_id: user.id,
          kind: 'balance',
        },
        idempotencyKey: topupId,
      })
    } catch (e) {
      // Откатываем topup — YooKassa не взяла заявку.
      await admin.from('balance_topups').update({ status: 'cancelled' }).eq('id', topupId)
      if (e instanceof YooKassaError) {
        console.error('[balance/topup] YooKassa error:', e.message, e.code)
        return NextResponse.json(
          { error: 'Ошибка платёжной системы. Попробуйте позже.' },
          { status: 502 }
        )
      }
      throw e
    }

    if (!ykPayment.confirmation?.confirmation_url) {
      await admin.from('balance_topups').update({ status: 'cancelled' }).eq('id', topupId)
      return NextResponse.json(
        { error: 'YooKassa не вернула ссылку на оплату' },
        { status: 502 }
      )
    }

    // Сохраняем yookassa_payment_id.
    await admin
      .from('balance_topups')
      .update({
        yookassa_payment_id: ykPayment.id,
        metadata: { yookassa_created_at: ykPayment.created_at, yookassa_status: ykPayment.status },
      })
      .eq('id', topupId)

    await logAuditEvent(request, {
      category: 'payment',
      action: 'balance_topup_created',
      target_type: 'balance_topups',
      target_id: topupId,
      payload: {
        yookassa_payment_id: ykPayment.id,
        amount_kopecks: amountKopecks,
        user_id: user.id,
      },
    })

    return NextResponse.json({
      confirmationUrl: ykPayment.confirmation.confirmation_url,
      topupId,
    })
  } catch (e) {
    console.error('[balance/topup] Unexpected error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
