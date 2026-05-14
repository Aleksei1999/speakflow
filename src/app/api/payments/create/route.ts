import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getYooKassaClient } from '@/lib/yookassa/client'
import { YooKassaError } from '@/lib/yookassa/types'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'

const createPaymentSchema = z.object({
  lessonId: z.string().uuid('Некорректный ID урока'),
})

export async function POST(request: NextRequest) {
  try {
    // --- 1. Аутентификация ---
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      )
    }

    // Rate-limit: 5 попыток создать платёж в минуту на пользователя.
    // fail-closed — финансовая операция, лучше отказать чем спам YooKassa-у.
    const limited = await enforceRateLimitStrict(request, {
      name: 'payments:create',
      keyParts: [user.id, getClientIp(request)],
      max: 5,
      windowSeconds: 60,
    })
    if (limited) return limited

    // --- 2. Валидация входных данных ---
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат запроса' },
        { status: 400 }
      )
    }

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      )
    }

    const { lessonId } = parsed.data

    // --- 3. Проверка урока ---
    type LessonRow = {
      id: string
      student_id: string
      teacher_id: string
      status: string
      price: number
      duration_minutes: number
    }
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, student_id, teacher_id, status, price, duration_minutes')
      .eq('id', lessonId)
      .single<LessonRow>()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Урок не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что пользователь -- студент этого урока
    if (lesson.student_id !== user.id) {
      return NextResponse.json(
        { error: 'Нет доступа к этому уроку' },
        { status: 403 }
      )
    }

    // Проверяем статус урока
    if (lesson.status !== 'pending_payment') {
      return NextResponse.json(
        { error: 'Урок не ожидает оплаты' },
        { status: 409 }
      )
    }

    // Проверяем что цена положительная
    if (!lesson.price || lesson.price <= 0) {
      return NextResponse.json(
        { error: 'Некорректная цена урока' },
        { status: 400 }
      )
    }

    // --- 4. Проверка существующего незавершённого платежа ---
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, yookassa_payment_id, status')
      .eq('lesson_id', lessonId)
      .eq('status', 'pending')
      .maybeSingle<{ id: string; yookassa_payment_id: string | null; status: string }>()

    if (existingPayment?.yookassa_payment_id) {
      // Уже есть pending-платеж -- проверим его статус в YooKassa
      try {
        const yookassa = getYooKassaClient()
        const existingYkPayment = await yookassa.getPayment(existingPayment.yookassa_payment_id)

        if (
          existingYkPayment.status === 'pending' &&
          existingYkPayment.confirmation?.confirmation_url
        ) {
          return NextResponse.json({
            confirmationUrl: existingYkPayment.confirmation.confirmation_url,
          })
        }
      } catch {
        // Старый платёж недоступен -- создадим новый
      }
    }

    // --- 5. Создание платежа в YooKassa ---
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://speakflow.ru'
    const yookassa = getYooKassaClient()

    const ykPayment = await yookassa.createPayment({
      amountKopecks: lesson.price,
      description: 'Урок английского языка - Raw English',
      returnUrl: `${siteUrl}/student/schedule`,
      metadata: {
        lesson_id: lessonId,
        student_id: user.id,
      },
      idempotencyKey: lessonId,
    })

    if (!ykPayment.confirmation?.confirmation_url) {
      return NextResponse.json(
        { error: 'Не удалось получить ссылку на оплату' },
        { status: 502 }
      )
    }

    // --- 6. Сохранение записи о платеже ---
    // FIXME(types): Postgrest UpsertBuilder инференсится в never
    const { error: insertError } = await (supabase.from('payments') as any)
      .upsert(
        {
          lesson_id: lessonId,
          student_id: user.id,
          yookassa_payment_id: ykPayment.id,
          amount: lesson.price,
          currency: 'RUB',
          status: 'pending',
          metadata: {
            yookassa_status: ykPayment.status,
            created_at: ykPayment.created_at,
          },
        },
        { onConflict: 'lesson_id' }
      )

    if (insertError) {
      // Платёж в YooKassa создан, но не сохранён локально -- логируем
      console.error('[payments/create] Ошибка сохранения платежа:', insertError)
      // Всё равно отдаём ссылку -- вебхук обработает остальное
    }

    return NextResponse.json({
      confirmationUrl: ykPayment.confirmation.confirmation_url,
    })
  } catch (error) {
    if (error instanceof YooKassaError) {
      console.error('[payments/create] YooKassa error:', error.message, error.code)
      return NextResponse.json(
        { error: 'Ошибка платёжной системы. Попробуйте позже.' },
        { status: 502 }
      )
    }

    console.error('[payments/create] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
