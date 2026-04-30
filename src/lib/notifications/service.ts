// @ts-nocheck
/**
 * Унифицированный сервис уведомлений Raw English.
 *
 * Алгоритм:
 * 1. Подгружает профиль (email, telegram_chat_id, notification_prefs).
 * 2. Для не-транзакционных типов проверяет preference-флаг в profiles.notification_prefs.
 *    Если флаг выключен — отправка пропускается (лог со статусом 'skipped').
 * 3. Канал доставки (email / telegram / both) для не-транзакционных типов
 *    берётся из notification_prefs.channel (default 'telegram').
 *    Для транзакционных типов (welcome, booking_confirmation,
 *    lesson_summary_ready, payment_receipt) всегда отправляем по всем доступным
 *    каналам — это критические подтверждения.
 * 4. Если канал = 'telegram', но chat_id не привязан — fallback на email.
 *
 * Сигнатура `sendNotification(userId, type, data)` не меняется.
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
import {
  dailyChallengeEmail,
  streakWarningEmail,
  newClubEmail,
  achievementUnlockedEmail,
  levelUpEmail,
  leaderboardOvertakenEmail,
  weeklyDigestEmail,
  marketingPromoEmail,
  formatTelegramDailyChallenge,
  formatTelegramStreakWarning,
  formatTelegramNewClub,
  formatTelegramAchievementUnlocked,
  formatTelegramLevelUp,
  formatTelegramLeaderboardOvertaken,
  formatTelegramWeeklyDigest,
  formatTelegramMarketingPromo,
} from '@/lib/resend/templates-extended'

export type NotificationType =
  | 'welcome'
  | 'booking_confirmation'
  | 'lesson_cancelled'
  | 'lesson_reminder'
  | 'lesson_summary_ready'
  | 'payment_receipt'
  | 'daily_challenge'
  | 'streak_warning'
  | 'new_club'
  | 'achievement_unlocked'
  | 'level_up'
  | 'leaderboard_overtaken'
  | 'weekly_digest'
  | 'marketing_promo'

/**
 * Транзакционные типы — всегда отправляются по всем каналам (критические).
 * Для них игнорируется и PREF_KEY, и channel-предпочтение.
 */
const TRANSACTIONAL_TYPES: ReadonlySet<NotificationType> = new Set([
  'welcome',
  'booking_confirmation',
  'lesson_cancelled',
  'lesson_summary_ready',
  'payment_receipt',
])

/**
 * Маппинг типа уведомления → ключ в profiles.notification_prefs.
 * Если ключ отсутствует (транзакционные / lesson_reminder), preference
 * не проверяется и отправка не блокируется.
 *
 * NB: lesson_reminder НЕ транзакционный, но имеет preference-флаг
 *     `lesson_reminders` — при его отключении уведомление пропускается.
 */
const PREF_KEY: Partial<Record<NotificationType, string>> = {
  lesson_reminder: 'lesson_reminders',
  daily_challenge: 'daily_challenge',
  streak_warning: 'streak_warning',
  new_club: 'new_clubs',
  achievement_unlocked: 'achievements',
  level_up: 'achievements',
  leaderboard_overtaken: 'leaderboard',
  weekly_digest: 'email_digest',
  marketing_promo: 'marketing',
}

type NotificationChannel = 'email' | 'telegram' | 'both'

interface NotificationPrefs {
  lesson_reminders?: boolean
  daily_challenge?: boolean
  streak_warning?: boolean
  new_clubs?: boolean
  achievements?: boolean
  leaderboard?: boolean
  email_digest?: boolean
  marketing?: boolean
  channel?: NotificationChannel
  [key: string]: unknown
}

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

  // daily_challenge
  challengeTitle?: string
  xpReward?: number
  ctaUrl?: string

  // streak_warning
  streakDays?: number

  // new_club
  clubTitle?: string
  whenStr?: string
  host?: string

  // achievement_unlocked
  title?: string
  icon?: string

  // level_up
  newLevel?: number
  levelTitle?: string
  totalXp?: number

  // leaderboard_overtaken
  overtakenBy?: string
  newRank?: number

  // weekly_digest
  weekXp?: number
  lessonsAttended?: number
  topAchievement?: string

  // marketing_promo
  body?: string
  ctaLabel?: string

  // Общие
  [key: string]: unknown
}

/**
 * Отправляет уведомление пользователю, учитывая preference-флаги и выбранный канал.
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData
): Promise<void> {
  const supabase = createAdminClient()

  // Получаем профиль + prefs
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, full_name, telegram_chat_id, notification_prefs')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error(`[notifications] Профиль не найден для userId=${userId}:`, profileError)
    return
  }

  const prefs: NotificationPrefs = (profile.notification_prefs as NotificationPrefs) || {}
  const isTransactional = TRANSACTIONAL_TYPES.has(type)

  // ---------- Preference-gate ----------
  const prefKey = PREF_KEY[type]
  if (!isTransactional && prefKey) {
    const flag = prefs[prefKey]
    // Если пользователь явно выключил тип — пропускаем.
    if (flag === false) {
      await logNotification(supabase, {
        userId,
        type,
        channel: 'email', // channel тут формальный — главное 'skipped'
        data,
        status: 'skipped',
        errorMessage: `preference ${prefKey}=false`,
      })
      return
    }
  }

  // ---------- Определяем каналы ----------
  // Транзакционные = всегда both. Остальные — по prefs.channel (default telegram).
  const channelPref: NotificationChannel = isTransactional
    ? 'both'
    : normalizeChannel(prefs.channel)

  const hasChatId = !!profile.telegram_chat_id

  let sendViaEmail = false
  let sendViaTelegram = false

  if (isTransactional) {
    // Критические: оба канала (Telegram — при наличии chat_id).
    sendViaEmail = true
    sendViaTelegram = hasChatId
  } else if (channelPref === 'both') {
    sendViaEmail = true
    sendViaTelegram = hasChatId
  } else if (channelPref === 'email') {
    sendViaEmail = true
    sendViaTelegram = false
  } else {
    // channelPref === 'telegram'
    if (hasChatId) {
      sendViaTelegram = true
      sendViaEmail = false
    } else {
      // fallback: нет привязанного TG — шлём на email.
      sendViaEmail = true
      sendViaTelegram = false
    }
  }

  // ---------- Построение контента ----------
  const emailContent = sendViaEmail ? buildEmailContent(type, data, profile.full_name) : null
  const telegramText = sendViaTelegram ? buildTelegramText(type, data, profile.full_name) : null

  // ---------- Отправка email ----------
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

  // ---------- Отправка Telegram ----------
  if (telegramText && profile.telegram_chat_id) {
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

function formatClubWhen(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const fmt = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    }).format(d)
    return `${fmt} МСК`
  } catch {
    return ''
  }
}

function buildEmailContent(
  type: NotificationType,
  data: NotificationData,
  fullName: string
): { subject: string; html: string } | null {
  const name = data.name || fullName
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://raw-english.com'

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

    case 'lesson_cancelled': {
      const reason = (data as any).reason
      const cancelledBy = (data as any).cancelledByName || 'Собеседник'
      const subject = `Урок отменён · ${data.date || ''}`
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;color:#0A0A0A;max-width:560px;margin:0 auto;padding:24px">
          <h1 style="font-size:22px;font-weight:800;margin:0 0 12px">Урок отменён</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55">${cancelledBy} отменил(а) урок.</p>
          <div style="background:#FAFAF7;border:1px solid #EEEEEA;border-radius:12px;padding:14px 18px;font-size:14px;margin:14px 0">
            <div><b>Когда:</b> ${data.date || '—'} · ${data.time || ''}</div>
            <div><b>Длительность:</b> ${data.duration || 50} мин</div>
            ${reason ? `<div style="margin-top:8px"><b>Причина:</b> ${reason}</div>` : ''}
          </div>
          <p style="margin:0 0 12px;font-size:13px;color:#8A8A86">Можно перезаписаться на другое время в личном кабинете.</p>
        </div>
      `
      return { subject, html }
    }

    case 'lesson_reminder':
      return lessonReminderEmail(
        name,
        data.teacherOrStudentName || '',
        data.date || '',
        data.time || '',
        data.joinUrl || `${appUrl}/lesson`
      )

    case 'lesson_summary_ready':
      return lessonSummaryReadyEmail(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.summaryUrl || `${appUrl}/student/summaries`
      )

    case 'payment_receipt':
      return paymentReceiptEmail(
        name,
        data.amount || 0,
        data.date || new Date().toLocaleDateString('ru-RU'),
        data.description || 'Оплата урока'
      )

    case 'daily_challenge':
      return dailyChallengeEmail(
        name,
        data.challengeTitle || 'Ежедневный челлендж',
        data.xpReward || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'streak_warning':
      return streakWarningEmail(
        name,
        data.streakDays || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'new_club':
      return newClubEmail(
        name,
        data.clubTitle || (data as any).title || 'Speaking Club',
        data.whenStr ||
          formatClubWhen((data as any).start_at) ||
          '',
        data.host || (data as any).host_name || 'Raw English',
        data.ctaUrl || `${appUrl}/student/clubs`
      )

    case 'achievement_unlocked':
      return achievementUnlockedEmail(
        name,
        data.title || 'Новая ачивка',
        data.description || '',
        data.icon || '🏆',
        data.xpReward || 0,
        data.ctaUrl || `${appUrl}/student/profile`
      )

    case 'level_up':
      return levelUpEmail(
        name,
        data.newLevel || 1,
        data.levelTitle || '',
        data.totalXp || 0,
        data.ctaUrl || `${appUrl}/student/profile`
      )

    case 'leaderboard_overtaken':
      return leaderboardOvertakenEmail(
        name,
        data.overtakenBy || 'Кто-то',
        data.newRank || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'weekly_digest':
      return weeklyDigestEmail(
        name,
        data.weekXp || 0,
        data.lessonsAttended || 0,
        data.topAchievement || '—',
        data.streakDays || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'marketing_promo':
      return marketingPromoEmail(
        name,
        data.title || 'Новости Raw English',
        data.body || '',
        data.ctaLabel || 'Открыть',
        data.ctaUrl || `${appUrl}/`
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://raw-english.com'

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

    case 'lesson_cancelled': {
      const reason = (data as any).reason
      const cancelledBy = (data as any).cancelledByName || 'Собеседник'
      const lines = [
        `❌ <b>Урок отменён</b>`,
        ``,
        `${cancelledBy} отменил(а) урок.`,
        `🗓 ${data.date || '—'} · ${data.time || ''}`,
        `⏱ ${data.duration || 50} мин`,
      ]
      if (reason) lines.push(``, `<i>Причина:</i> ${reason}`)
      return lines.join('\n')
    }

    case 'lesson_reminder':
      return formatTelegramLessonReminder(
        name,
        data.teacherOrStudentName || '',
        data.time || '',
        data.joinUrl || `${appUrl}/lesson`
      )

    case 'lesson_summary_ready':
      return formatTelegramSummaryReady(
        data.studentName || name,
        data.teacherName || 'Преподаватель',
        data.date || '',
        data.summaryUrl || `${appUrl}/student/summaries`
      )

    case 'payment_receipt':
      return formatTelegramPaymentReceipt(
        name,
        data.amount || 0,
        data.description || 'Оплата урока'
      )

    case 'daily_challenge':
      return formatTelegramDailyChallenge(
        name,
        data.challengeTitle || 'Ежедневный челлендж',
        data.xpReward || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'streak_warning':
      return formatTelegramStreakWarning(
        name,
        data.streakDays || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'new_club':
      return formatTelegramNewClub(
        name,
        data.clubTitle || (data as any).title || 'Speaking Club',
        data.whenStr ||
          formatClubWhen((data as any).start_at) ||
          '',
        data.host || (data as any).host_name || 'Raw English',
        data.ctaUrl || `${appUrl}/student/clubs`
      )

    case 'achievement_unlocked':
      return formatTelegramAchievementUnlocked(
        name,
        data.title || 'Новая ачивка',
        data.description || '',
        data.icon || '🏆',
        data.xpReward || 0,
        data.ctaUrl || `${appUrl}/student/profile`
      )

    case 'level_up':
      return formatTelegramLevelUp(
        name,
        data.newLevel || 1,
        data.levelTitle || '',
        data.totalXp || 0,
        data.ctaUrl || `${appUrl}/student/profile`
      )

    case 'leaderboard_overtaken':
      return formatTelegramLeaderboardOvertaken(
        name,
        data.overtakenBy || 'Кто-то',
        data.newRank || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'weekly_digest':
      return formatTelegramWeeklyDigest(
        name,
        data.weekXp || 0,
        data.lessonsAttended || 0,
        data.topAchievement || '—',
        data.streakDays || 0,
        data.ctaUrl || `${appUrl}/student`
      )

    case 'marketing_promo':
      return formatTelegramMarketingPromo(
        name,
        data.title || 'Raw English',
        data.body || '',
        data.ctaLabel || 'Открыть',
        data.ctaUrl || `${appUrl}/`
      )

    default:
      return null
  }
}

// ---------- Вспомогательное ----------

function normalizeChannel(value: unknown): NotificationChannel {
  if (value === 'email' || value === 'telegram' || value === 'both') {
    return value
  }
  return 'telegram'
}

// ---------- Логирование ----------

async function logNotification(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    userId: string
    type: string
    channel: string
    data: Record<string, unknown>
    status: 'sent' | 'failed' | 'pending' | 'skipped'
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
    // Логирование не должно ломать основной флоу.
    console.error('[notifications] Ошибка записи лога уведомления:', err)
  }
}
