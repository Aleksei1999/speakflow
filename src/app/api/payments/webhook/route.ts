// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { YooKassaWebhookNotification, YooKassaPayment, YooKassaRefund } from '@/lib/yookassa/types'

/**
 * Допустимые IP-адреса YooKassa для вебхуков.
 * https://yookassa.ru/developers/using-api/webhooks#ip
 *
 * В продакшне рекомендуется также настроить фильтрацию на уровне
 * reverse-proxy / WAF / Cloudflare Access.
 */
const YOOKASSA_ALLOWED_IPS = new Set([
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
])

/**
 * Проверяет, входит ли IP в разрешённый диапазон YooKassa.
 * Для CIDR-диапазонов выполняется побитовое сравнение.
 * В production за reverse-proxy IP приходит в X-Forwarded-For.
 */
function isAllowedIp(ip: string): boolean {
  if (!ip) return false

  // В dev-окружении пропускаем проверку IP
  if (process.env.NODE_ENV === 'development') return true

  for (const allowed of YOOKASSA_ALLOWED_IPS) {
    if (allowed.includes('/')) {
      if (ipInCidr(ip, allowed)) return true
    } else {
      if (ip === allowed) return true
    }
  }
  return false
}

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return -1
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
}

function ipInCidr(ip: string, cidr: string): boolean {
  // IPv6 CIDR -- пропускаем упрощённую проверку, полагаемся на WAF
  if (cidr.includes(':')) return false

  const [subnet, bits] = cidr.split('/')
  if (!subnet || !bits) return false

  const ipLong = ipToLong(ip)
  const subnetLong = ipToLong(subnet)
  if (ipLong === -1 || subnetLong === -1) return false

  const mask = (~0 << (32 - parseInt(bits, 10))) >>> 0
  return (ipLong & mask) === (subnetLong & mask)
}

/** Комиссия платформы: 15% */
const PLATFORM_FEE_RATE = 0.15

function isPaymentObject(obj: unknown): obj is YooKassaPayment {
  return typeof obj === 'object' && obj !== null && 'paid' in obj
}

function isRefundObject(obj: unknown): obj is YooKassaRefund {
  return typeof obj === 'object' && obj !== null && 'payment_id' in obj && !('paid' in obj)
}

export async function POST(request: NextRequest) {
  // --- 1. Проверка IP отправителя ---
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const clientIp = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? ''

  if (!isAllowedIp(clientIp)) {
    console.warn(`[webhook] Запрос с недопустимого IP: ${clientIp}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // --- 2. Парсинг тела уведомления ---
  let notification: YooKassaWebhookNotification
  try {
    notification = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (notification.type !== 'notification' || !notification.event || !notification.object) {
    return NextResponse.json({ error: 'Invalid notification format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (notification.event) {
      case 'payment.succeeded': {
        if (!isPaymentObject(notification.object)) break
        await handlePaymentSucceeded(supabase, notification.object)
        break
      }
      case 'payment.canceled': {
        if (!isPaymentObject(notification.object)) break
        await handlePaymentCanceled(supabase, notification.object)
        break
      }
      case 'refund.succeeded': {
        if (!isRefundObject(notification.object)) break
        await handleRefundSucceeded(supabase, notification.object)
        break
      }
      case 'payment.waiting_for_capture': {
        // Для auto-capture этот статус обычно не приходит, но обработаем
        break
      }
      default: {
        console.warn(`[webhook] Неизвестное событие: ${notification.event}`)
      }
    }
  } catch (error) {
    // Логируем, но отдаём 200 -- YooKassa будет повторять при non-2xx
    // Идемпотентность гарантирует безопасность повторной обработки
    console.error(`[webhook] Ошибка обработки ${notification.event}:`, error)
  }

  // YooKassa ожидает быстрый 200 OK
  return NextResponse.json({ status: 'ok' })
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  payment: YooKassaPayment
) {
  const yookassaPaymentId = payment.id
  const lessonId = payment.metadata?.lesson_id
  const studentId = payment.metadata?.student_id

  if (!lessonId || !studentId) {
    console.error('[webhook] payment.succeeded без metadata lesson_id/student_id:', yookassaPaymentId)
    return
  }

  // --- Идемпотентность: проверяем, не обработан ли уже ---
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('yookassa_payment_id', yookassaPaymentId)
    .maybeSingle()

  if (existingPayment?.status === 'succeeded') {
    // Уже обработано -- пропускаем
    return
  }

  // --- Обновление/создание записи о платеже ---
  const paymentAmountKopecks = Math.round(parseFloat(payment.amount.value) * 100)

  const { data: paymentRecord, error: paymentError } = await supabase
    .from('payments')
    .upsert(
      {
        lesson_id: lessonId,
        student_id: studentId,
        yookassa_payment_id: yookassaPaymentId,
        amount: paymentAmountKopecks,
        currency: payment.amount.currency,
        status: 'succeeded' as const,
        payment_method: payment.payment_method?.type ?? null,
        paid_at: payment.captured_at ?? new Date().toISOString(),
        metadata: {
          yookassa_id: yookassaPaymentId,
          payment_method_type: payment.payment_method?.type,
        },
      },
      { onConflict: 'lesson_id' }
    )
    .select('id')
    .single()

  if (paymentError) {
    console.error('[webhook] Ошибка обновления платежа:', paymentError)
    throw paymentError
  }

  // --- Обновление статуса урока на 'booked' ---
  const { data: lesson } = await supabase
    .from('lessons')
    .select('teacher_id, status')
    .eq('id', lessonId)
    .single()

  if (lesson && lesson.status === 'pending_payment') {
    // Генерируем имя комнаты Jitsi как UUID урока
    await supabase
      .from('lessons')
      .update({ status: 'booked', jitsi_room_name: lessonId })
      .eq('id', lessonId)
  }

  // --- Создание записи о доходе преподавателя ---
  if (lesson?.teacher_id && paymentRecord?.id) {
    const platformFee = Math.round(paymentAmountKopecks * PLATFORM_FEE_RATE)
    const netAmount = paymentAmountKopecks - platformFee

    await supabase
      .from('teacher_earnings')
      .upsert(
        {
          teacher_id: lesson.teacher_id,
          lesson_id: lessonId,
          payment_id: paymentRecord.id,
          gross_amount: paymentAmountKopecks,
          platform_fee: platformFee,
          net_amount: netAmount,
          currency: payment.amount.currency,
          status: 'pending' as const,
        },
        { onConflict: 'lesson_id' }
      )
  }
}

async function handlePaymentCanceled(
  supabase: ReturnType<typeof createAdminClient>,
  payment: YooKassaPayment
) {
  const yookassaPaymentId = payment.id
  const lessonId = payment.metadata?.lesson_id

  if (!lessonId) {
    console.error('[webhook] payment.canceled без metadata lesson_id:', yookassaPaymentId)
    return
  }

  // --- Идемпотентность ---
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('yookassa_payment_id', yookassaPaymentId)
    .maybeSingle()

  if (existingPayment?.status === 'cancelled') {
    return
  }

  // --- Обновление платежа ---
  await supabase
    .from('payments')
    .update({
      status: 'cancelled' as const,
      metadata: {
        yookassa_id: yookassaPaymentId,
        canceled_at: new Date().toISOString(),
      },
    })
    .eq('yookassa_payment_id', yookassaPaymentId)

  // --- Отмена урока ---
  await supabase
    .from('lessons')
    .update({ status: 'cancelled' })
    .eq('id', lessonId)
    .eq('status', 'pending_payment')
}

async function handleRefundSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  refund: YooKassaRefund
) {
  const yookassaPaymentId = refund.payment_id

  // Находим платёж по yookassa_payment_id
  const { data: paymentRecord } = await supabase
    .from('payments')
    .select('id, lesson_id, status')
    .eq('yookassa_payment_id', yookassaPaymentId)
    .maybeSingle()

  if (!paymentRecord) {
    console.error('[webhook] refund.succeeded: платёж не найден:', yookassaPaymentId)
    return
  }

  // --- Идемпотентность ---
  if (paymentRecord.status === 'refunded') {
    return
  }

  // --- Обновление статуса платежа ---
  await supabase
    .from('payments')
    .update({
      status: 'refunded' as const,
      refunded_at: refund.created_at ?? new Date().toISOString(),
    })
    .eq('id', paymentRecord.id)

  // --- Обновление записи о доходе преподавателя ---
  if (paymentRecord.lesson_id) {
    await supabase
      .from('teacher_earnings')
      .update({ status: 'cancelled' as const })
      .eq('lesson_id', paymentRecord.lesson_id)
  }
}
