import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { YooKassaClient } from '@/lib/yookassa/client'
import type { YooKassaWebhookNotification, YooKassaPayment, YooKassaRefund } from '@/lib/yookassa/types'
import { enforceRateLimit, getClientIp } from '@/lib/api/rate-limit'

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
  // Rate-limit: защита от webhook-flood. 60 уведомлений/мин на IP
  // (фактический YooKassa в норме шлёт 1-2 уведомления/мин).
  // fail-open — НЕ блокируем платёжного провайдера при отказе RPC.
  const limited = await enforceRateLimit(request, {
    name: 'payments:webhook',
    keyParts: [getClientIp(request)],
    max: 60,
    windowSeconds: 60,
    failMode: 'open',
  })
  if (limited) return limited

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
  webhookPayment: YooKassaPayment
) {
  const yookassaPaymentId = webhookPayment.id
  if (!yookassaPaymentId) {
    console.error('[webhook] payment.succeeded без id')
    return
  }

  // Идемпотентность: уже обработан → выходим.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('yookassa_payment_id', yookassaPaymentId)
    .maybeSingle<{ id: string; status: string }>()
  if (existingPayment?.status === 'succeeded') return

  // НЕ доверяем телу webhook'а полностью (IP можно подделать через
  // misconfig proxy). Тянем тот же payment напрямую из YooKassa API
  // с нашим shopId+secret — это authoritative source.
  let payment: YooKassaPayment
  try {
    const client = new YooKassaClient()
    payment = await client.getPayment(yookassaPaymentId)
  } catch (e) {
    console.error('[webhook] YooKassa getPayment failed:', yookassaPaymentId, e)
    throw e
  }

  if (payment.status !== 'succeeded' || !payment.paid) {
    console.warn(
      `[webhook] payment.succeeded webhook, но API status=${payment.status} paid=${payment.paid}: ${yookassaPaymentId}`
    )
    return
  }

  const lessonId = payment.metadata?.lesson_id
  const studentId = payment.metadata?.student_id
  if (!lessonId || !studentId) {
    console.error('[webhook] payment без metadata lesson_id/student_id:', yookassaPaymentId)
    return
  }

  // Тянем урок отдельно, сверяем что он реально pending_payment и что
  // сумма платежа совпадает с lesson.price.
  const { data: lesson } = await supabase
    .from('lessons')
    .select('teacher_id, student_id, status, price')
    .eq('id', lessonId)
    .single<{ teacher_id: string; student_id: string; status: string; price: number }>()

  if (!lesson) {
    console.error('[webhook] lesson не найден:', lessonId, yookassaPaymentId)
    return
  }
  if (lesson.student_id !== studentId) {
    console.error(
      `[webhook] student_id mismatch: lesson.student_id=${lesson.student_id} payment.metadata.student_id=${studentId}`,
      yookassaPaymentId
    )
    return
  }
  if (lesson.status !== 'pending_payment') {
    console.warn(
      `[webhook] lesson не в pending_payment (status=${lesson.status}): ${lessonId}`
    )
    return
  }

  const paymentAmountKopecks = Math.round(parseFloat(payment.amount.value) * 100)
  if (payment.amount.currency !== 'RUB') {
    console.error(`[webhook] unsupported currency ${payment.amount.currency}:`, yookassaPaymentId)
    return
  }
  if (typeof lesson.price === 'number' && paymentAmountKopecks !== lesson.price) {
    console.error(
      `[webhook] amount mismatch: paid=${paymentAmountKopecks} expected=${lesson.price} payment=${yookassaPaymentId}`
    )
    return
  }

  // Только сейчас — записываем payment + переключаем lesson + earnings.
  // FIXME(types): Postgrest UpsertBuilder инференсится в never
  const { data: paymentRecord, error: paymentError } = (await (supabase.from('payments') as any)
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
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (paymentError) {
    console.error('[webhook] Ошибка записи платежа:', paymentError)
    throw paymentError
  }

  // FIXME(types): Postgrest UpdateBuilder инференсится в never
  await (supabase.from('lessons') as any)
    .update({ status: 'booked', jitsi_room_name: lessonId })
    .eq('id', lessonId)
    .eq('status', 'pending_payment') // защита от гонки с конкурентной транзакцией

  if (lesson.teacher_id && paymentRecord?.id) {
    const platformFee = Math.round(paymentAmountKopecks * PLATFORM_FEE_RATE)
    const netAmount = paymentAmountKopecks - platformFee
    // FIXME(types): Postgrest UpsertBuilder инференсится в never
    await (supabase.from('teacher_earnings') as any)
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
  webhookPayment: YooKassaPayment
) {
  const yookassaPaymentId = webhookPayment.id
  if (!yookassaPaymentId) return

  // Идемпотентность.
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('yookassa_payment_id', yookassaPaymentId)
    .maybeSingle<{ id: string; status: string }>()
  if (existingPayment?.status === 'cancelled') return

  // Подтверждаем cancellation через API — не верим телу webhook'а.
  let payment: YooKassaPayment
  try {
    const client = new YooKassaClient()
    payment = await client.getPayment(yookassaPaymentId)
  } catch (e) {
    console.error('[webhook] YooKassa getPayment failed (cancel):', yookassaPaymentId, e)
    throw e
  }
  if (payment.status !== 'canceled') {
    console.warn(`[webhook] cancel webhook, но API status=${payment.status}: ${yookassaPaymentId}`)
    return
  }

  const lessonId = payment.metadata?.lesson_id
  if (!lessonId) {
    console.error('[webhook] payment.canceled без metadata lesson_id:', yookassaPaymentId)
    return
  }

  // FIXME(types): Postgrest UpdateBuilder инференсится в never
  await (supabase.from('payments') as any)
    .update({
      status: 'cancelled' as const,
      metadata: {
        yookassa_id: yookassaPaymentId,
        canceled_at: new Date().toISOString(),
      },
    })
    .eq('yookassa_payment_id', yookassaPaymentId)

  // FIXME(types): Postgrest UpdateBuilder инференсится в never
  await (supabase.from('lessons') as any)
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
    .maybeSingle<{ id: string; lesson_id: string; status: string }>()

  if (!paymentRecord) {
    console.error('[webhook] refund.succeeded: платёж не найден:', yookassaPaymentId)
    return
  }

  // --- Идемпотентность ---
  if (paymentRecord.status === 'refunded') {
    return
  }

  // --- Обновление статуса платежа ---
  // FIXME(types): Postgrest UpdateBuilder инференсится в never
  await (supabase.from('payments') as any)
    .update({
      status: 'refunded' as const,
      refunded_at: refund.created_at ?? new Date().toISOString(),
    })
    .eq('id', paymentRecord.id)

  // --- Обновление записи о доходе преподавателя ---
  if (paymentRecord.lesson_id) {
    // FIXME(types): Postgrest UpdateBuilder инференсится в never
    await (supabase.from('teacher_earnings') as any)
      .update({ status: 'cancelled' as const })
      .eq('lesson_id', paymentRecord.lesson_id)
  }
}
