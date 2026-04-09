import { NextRequest, NextResponse } from 'next/server'
import { sendNotification, type NotificationType } from '@/lib/notifications/service'

/**
 * Internal API для отправки уведомлений.
 *
 * Предназначен для серверного использования (другие API-роуты, cron-джобы).
 * Защищён проверкой секретного ключа или авторизацией админа.
 */

const VALID_TYPES: NotificationType[] = [
  'lesson_reminder',
  'booking_confirmation',
  'lesson_summary_ready',
  'payment_receipt',
  'welcome',
]

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию: внутренний секретный ключ
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.INTERNAL_API_SECRET

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId, type, data } = body

    // Валидация
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId обязателен' },
        { status: 400 }
      )
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Некорректный тип уведомления. Допустимые: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'data должен быть объектом' },
        { status: 400 }
      )
    }

    await sendNotification(userId, type as NotificationType, data)

    return NextResponse.json({ status: 'sent' })
  } catch (error) {
    console.error('[notifications/send] Ошибка:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
