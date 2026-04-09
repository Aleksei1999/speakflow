// @ts-nocheck
/**
 * Унифицированный сервис уведомлений SpeakFlow.
 *
 * Определяет предпочтения пользователя (email всегда, Telegram при наличии chat_id),
 * отправляет уведомления через соответствующие каналы и логирует результаты.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/resend/client'
import { sendTelegramMessage } from '@/lib/telegram/bot'
import {
  welcomeEmail,
  bookingConfirmationEmail,
  lessonReminderEmail,
  lessonSummaryReadyEmail,
  paymentReceiptEmail,
  formatTelegramWelcome,
  formatTelegramBookingConfirmation,
  formatTelegramLessonReminder,
  formatTelegramSummaryReady,
  formatTelegramPaymentReceipt,
} from '@/lib/resend/templates'

export type NotificationType =
  | 'lesson_reminder'
  | 'booking_confirmation'
  | 'lesson_summary_ready'
  | 'payment_receipt'
  | 'welcome'

interface NotificationData {
  // welcome
  name?: string

  // booking_confirmation
  studentName?: string
  teacherName?: string
  date?: string
  time?: string
  duration?: number

  // lesson_reminder
  teacherOrStudentName?: string
  joinUrl?: string

  // lesson_summary_ready
  summaryUrl?: string

  // payment_receipt
  amount?: number
  description?: string

  // Общие
  [key: string]: unknown
}

/**
 * Отправляет уведомление пользователю через все доступные каналы.
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData
): Promise<void> {
  const supabase = createAdminClient()

  // Получаем профиль пользователя
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, full_name, telegram_chat_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error(`[notifications] Профиль не найден для userId=${userId}:`, profileError)
    return
  }

  // Подготавливаем email-контент
  const emailContent = buildEmailContent(type, data, profile.full_name)
  const telegramText = buildTelegramText(type, data, profile.full_name)

  // Отправляем email (всегда)
  if (emailContent) {
    const emailResult = await sendEmail({
      to: profile.email,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    await logNotification(supabase, {
      userId,
      type,
      channel: 'email',
      data,
      status: emailResult.success ? 'sent' : 'failed',
      errorMessage: emailResult.error || null,
    })
  }

  // Отправляем в Telegram (если привязан)
  if (profile.telegram_chat_id && telegramText) {
    const tgResult = await sendTelegramMessage({
      chatId: profile.telegram_chat_id,
      text: telegramText,
    })

    await logNotification(supabase, {
      userId,
      type,
      channel: 'telegram',
      data,
      status: tgResult.success ? 'sent' : 'failed',
      errorMessage: tgResult.error || null,
    })
  }
}

// ---------- Построение контента ----------

function buildEmailContent(
  type: NotificationType,
  data: NotificationData,
  fullName: string
): { subject: string; html: string } | null {
  const name = data.name || fullName

  switch (type) {
    case 'welcome':
      return welcomeEmail(name)

    case 'booking_confirmation':
      return bookingConfirmationEmail(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.time || '',
        data.duration || 50
      )

    case 'lesson_reminder':
      return lessonReminderEmail(
        name,
        data.teacherOrStudentName || '',
        data.date || '',
        data.time || '',
        data.joinUrl || `${process.env.NEXT_PUBLIC_APP_URL}/lesson`
      )

    case 'lesson_summary_ready':
      return lessonSummaryReadyEmail(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.summaryUrl || `${process.env.NEXT_PUBLIC_APP_URL}/student/summaries`
      )

    case 'payment_receipt':
      return paymentReceiptEmail(
        name,
        data.amount || 0,
        data.date || new Date().toLocaleDateString('ru-RU'),
        data.description || 'Оплата урока'
      )

    default:
      console.warn(`[notifications] Неизвестный тип уведомления для email: ${type}`)
      return null
  }
}

function buildTelegramText(
  type: NotificationType,
  data: NotificationData,
  fullName: string
): string | null {
  const name = data.name || fullName

  switch (type) {
    case 'welcome':
      return formatTelegramWelcome(name)

    case 'booking_confirmation':
      return formatTelegramBookingConfirmation(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.time || '',
        data.duration || 50
      )

    case 'lesson_reminder':
      return formatTelegramLessonReminder(
        name,
        data.teacherOrStudentName || '',
        data.time || '',
        data.joinUrl || `${process.env.NEXT_PUBLIC_APP_URL}/lesson`
      )

    case 'lesson_summary_ready':
      return formatTelegramSummaryReady(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.summaryUrl || `${process.env.NEXT_PUBLIC_APP_URL}/student/summaries`
      )

    case 'payment_receipt':
      return formatTelegramPaymentReceipt(
        name,
        data.amount || 0,
        data.description || 'Оплата урока'
      )

    default:
      return null
  }
}

// ---------- Логирование ----------

async function logNotification(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    userId: string
    type: string
    channel: string
    data: Record<string, unknown>
    status: 'sent' | 'failed' | 'pending'
    errorMessage: string | null
  }
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      channel: params.channel,
      data: params.data as unknown as import('@/types/database').Json,
      status: params.status,
      error_message: params.errorMessage,
    })
  } catch (err) {
    // Логирование не должно ломать основной флоу
    console.error('[notifications] Ошибка записи лога уведомления:', err)
  }
}
