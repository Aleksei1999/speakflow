// ---------------------------------------------------------------
// src/lib/notifications/subscription-events.ts
//
// Уведомления преподавателю по событиям регулярных серий уроков
// (lesson_subscriptions, phase 4 recurring slots).
//
// События:
//   1. notifySubscriptionCreated     — студент закрепил серию
//   2. notifySubscriptionCancelled   — серия отменена (целиком / с даты)
//   3. notifyLessonCancelled         — отменён один occurrence из серии
//
// Каналы: email (Resend) + Telegram (наш bot).
// Каждый канал учитывает profiles.notification_prefs.lesson_reminders
// (этот же флаг — для transactional booking_confirmation; пользователь
// уже привык к тому, что он управляет «уроковыми» нотификациями).
//
// Локализация — по profiles.language ('ru' | 'en'). Дефолт 'ru'.
//
// ВСЕ функции fire-and-forget: ошибки log-only, никогда не бросаем,
// чтобы не валить родительский API-запрос.
// ---------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/resend/client'
import { sendTelegramMessage } from '@/lib/telegram/bot'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

type AdminClient = SupabaseClient<any, any, any>

type Lang = 'ru' | 'en'

interface PatternEntry {
  dow: number // 0=Sun … 6=Sat
  time: string // 'HH:MM'
  duration_min?: number
}

interface SubscriptionRow {
  id: string
  student_id: string
  teacher_id: string // teacher_profiles.id
  weekly_pattern: PatternEntry[]
  starts_on: string // 'YYYY-MM-DD'
  ends_on: string
  status: string
}

interface LessonRow {
  id: string
  student_id: string
  teacher_id: string
  scheduled_at: string
  duration_minutes: number | null
  subscription_id: string | null
}

interface TeacherInfo {
  user_id: string
  email: string
  full_name: string
  language: Lang
  telegram_chat_id: string | null
  lesson_reminders: boolean
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://raw-english.com'

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeLang(value: unknown): Lang {
  return value === 'en' ? 'en' : 'ru'
}

const DOW_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatPattern(pattern: PatternEntry[], lang: Lang): string {
  if (!Array.isArray(pattern) || pattern.length === 0) return '—'
  const dows = lang === 'ru' ? DOW_RU : DOW_EN
  // Сортируем по дню недели + времени для стабильного порядка.
  const sorted = [...pattern].sort(
    (a, b) => a.dow - b.dow || a.time.localeCompare(b.time)
  )
  return sorted
    .map((p) => `${dows[p.dow] ?? '?'} ${p.time}`)
    .join(lang === 'ru' ? ' + ' : ' + ')
}

function pluralWeeksRu(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'неделю'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return 'недели'
  return 'недель'
}

function weeksBetween(starts: string, ends: string): number {
  try {
    const s = new Date(starts + 'T00:00:00Z').getTime()
    const e = new Date(ends + 'T00:00:00Z').getTime()
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0
    return Math.max(1, Math.round((e - s + 86_400_000) / (7 * 86_400_000)))
  } catch {
    return 0
  }
}

function formatDateLong(iso: string, lang: Lang): string {
  try {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', {
      day: '2-digit',
      month: 'long',
      timeZone: 'Europe/Moscow',
    }).format(d)
  } catch {
    return iso
  }
}

function formatLessonDateTime(iso: string, lang: Lang): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const date = new Intl.DateTimeFormat(
      lang === 'ru' ? 'ru-RU' : 'en-GB',
      {
        day: '2-digit',
        month: 'long',
        timeZone: 'Europe/Moscow',
      }
    ).format(d)
    const time = new Intl.DateTimeFormat(
      lang === 'ru' ? 'ru-RU' : 'en-GB',
      {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
      }
    ).format(d)
    return lang === 'ru' ? `${date}, ${time} МСК` : `${date}, ${time} MSK`
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------
// DB lookups
// ---------------------------------------------------------------

async function fetchSubscription(
  admin: AdminClient,
  subId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await (admin as any)
    .from('lesson_subscriptions')
    .select(
      'id, student_id, teacher_id, weekly_pattern, starts_on, ends_on, status'
    )
    .eq('id', subId)
    .maybeSingle()
  if (error) {
    console.error('[sub-events] fetchSubscription failed', error.message)
    return null
  }
  return (data as SubscriptionRow) ?? null
}

async function fetchLesson(
  admin: AdminClient,
  lessonId: string
): Promise<LessonRow | null> {
  const { data, error } = await (admin as any)
    .from('lessons')
    .select(
      'id, student_id, teacher_id, scheduled_at, duration_minutes, subscription_id'
    )
    .eq('id', lessonId)
    .maybeSingle()
  if (error) {
    console.error('[sub-events] fetchLesson failed', error.message)
    return null
  }
  return (data as LessonRow) ?? null
}

async function fetchTeacherInfo(
  admin: AdminClient,
  teacherProfileId: string
): Promise<TeacherInfo | null> {
  // teacher_profiles.id → user_id → profiles.*
  const tpRes = await (admin as any)
    .from('teacher_profiles')
    .select('user_id')
    .eq('id', teacherProfileId)
    .maybeSingle()
  const tp = tpRes.data as { user_id: string } | null
  if (!tp?.user_id) return null

  const profRes = await (admin as any)
    .from('profiles')
    .select(
      'email, full_name, telegram_chat_id, language, notification_prefs'
    )
    .eq('id', tp.user_id)
    .maybeSingle()
  const prof = profRes.data as
    | {
        email: string | null
        full_name: string | null
        telegram_chat_id: string | null
        language: string | null
        notification_prefs: { lesson_reminders?: boolean } | null
      }
    | null
  if (!prof?.email) return null

  return {
    user_id: tp.user_id,
    email: prof.email,
    full_name: prof.full_name || 'Преподаватель',
    language: safeLang(prof.language),
    telegram_chat_id: prof.telegram_chat_id,
    // По умолчанию (если поле отсутствует) — true: уроковые
    // нотификации включены, как в дефолте миграции 025.
    lesson_reminders: prof.notification_prefs?.lesson_reminders !== false,
  }
}

async function fetchStudentName(
  admin: AdminClient,
  userId: string
): Promise<string> {
  const { data } = await (admin as any)
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()
  return (data as { full_name: string | null } | null)?.full_name || 'Ученик'
}

// ---------------------------------------------------------------
// Email layout
// ---------------------------------------------------------------

function emailLayout(params: {
  heading: string
  intro: string
  detailsHtml: string
  ctaLabel: string
  ctaUrl: string
  lang: Lang
}): string {
  const { heading, intro, detailsHtml, ctaLabel, ctaUrl, lang } = params
  const footerLabel =
    lang === 'ru'
      ? 'Это автоматическое уведомление Raw English.'
      : 'This is an automated Raw English notification.'
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F5F3;padding:32px 16px;">
<tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#FFFFFF;border-radius:18px;border:1px solid #EEEEEA;overflow:hidden;">
    <tr><td style="padding:28px 32px 16px;border-bottom:1px solid #EEEEEA;font-family:Inter,Arial,sans-serif;font-size:12px;color:#8A8A86;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Raw English</td></tr>
    <tr><td style="padding:32px 32px 24px;color:#0A0A0A;">
      <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0A0A0A;">${escapeHtml(intro)}</p>
      ${detailsHtml}
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
        <tr><td bgcolor="#0A0A0A" style="border-radius:999px;">
          <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 32px 24px;border-top:1px solid #EEEEEA;background:#FAFAF7;font-size:12px;color:#8A8A86;line-height:1.55;font-family:Inter,Arial,sans-serif;">
      ${escapeHtml(footerLabel)}
    </td></tr>
  </table>
</td></tr>
</table></body></html>`
}

function detailRow(label: string, value: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background:#FAFAF7;border-radius:10px;margin:0 0 10px;">
<tr><td style="padding:12px 16px;font-family:Inter,Arial,sans-serif;">
  <div style="font-size:12px;color:#8A8A86;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin:0 0 4px;">${escapeHtml(label)}</div>
  <div style="font-size:15px;color:#0A0A0A;font-weight:600;line-height:1.4;">${escapeHtml(value)}</div>
</td></tr></table>`
}

// ---------------------------------------------------------------
// Channel dispatch
// ---------------------------------------------------------------

async function dispatch(
  teacher: TeacherInfo,
  payload: {
    subject: string
    html: string
    telegramText: string
  }
): Promise<void> {
  // Preference-gate. Если препод отключил уроковые нотификации — молча skip.
  if (!teacher.lesson_reminders) {
    console.log(
      `[sub-events] teacher ${teacher.user_id} disabled lesson_reminders — skip`
    )
    return
  }

  // Email — всегда (как только канал есть).
  try {
    const res = await sendEmail({
      to: teacher.email,
      subject: payload.subject,
      html: payload.html,
    })
    if (!res.success) {
      console.error(
        '[sub-events] email send failed',
        teacher.user_id,
        res.error
      )
    }
  } catch (err) {
    console.error('[sub-events] email exception', err)
  }

  // Telegram — только если привязан chat_id.
  if (teacher.telegram_chat_id) {
    try {
      const res = await sendTelegramMessage({
        chatId: teacher.telegram_chat_id,
        text: payload.telegramText,
        parseMode: 'HTML',
        disableWebPagePreview: true,
      })
      if (!res.success) {
        console.error(
          '[sub-events] telegram send failed',
          teacher.user_id,
          res.error
        )
      }
    } catch (err) {
      console.error('[sub-events] telegram exception', err)
    }
  }
}

// ---------------------------------------------------------------
// 1. Subscription created
// ---------------------------------------------------------------

export async function notifySubscriptionCreated(
  admin: AdminClient,
  subId: string
): Promise<void> {
  try {
    const sub = await fetchSubscription(admin, subId)
    if (!sub) return

    const teacher = await fetchTeacherInfo(admin, sub.teacher_id)
    if (!teacher) return

    const studentName = await fetchStudentName(admin, sub.student_id)
    const lang = teacher.language
    const patternStr = formatPattern(sub.weekly_pattern || [], lang)
    const weeks = weeksBetween(sub.starts_on, sub.ends_on)
    const totalLessons = weeks * (sub.weekly_pattern?.length || 0)
    const studentUrl = `${APP_URL}/teacher/students/${sub.student_id}`

    let subject: string
    let intro: string
    let details: string
    let ctaLabel: string
    let tgText: string

    if (lang === 'ru') {
      subject = `Новая серия уроков от ${studentName}`
      intro = `${studentName} закрепил у тебя регулярные занятия.`
      details =
        detailRow('Расписание', patternStr) +
        detailRow(
          'Длительность',
          `${weeks} ${pluralWeeksRu(weeks)} · всего ${totalLessons} занятий`
        ) +
        detailRow('Старт', formatDateLong(sub.starts_on, lang))
      ctaLabel = 'Открыть профиль ученика'
      tgText =
        `🗓 <b>Новая серия уроков</b>\n\n` +
        `<b>${escapeHtml(studentName)}</b> закрепил у тебя:\n` +
        `${escapeHtml(patternStr)}\n` +
        `на ${weeks} ${pluralWeeksRu(weeks)} (${totalLessons} занятий).\n\n` +
        `<a href="${studentUrl}">Открыть профиль ученика</a>`
    } else {
      subject = `New recurring series from ${studentName}`
      intro = `${studentName} booked a recurring series with you.`
      details =
        detailRow('Schedule', patternStr) +
        detailRow('Duration', `${weeks} weeks · ${totalLessons} lessons total`) +
        detailRow('Starts', formatDateLong(sub.starts_on, lang))
      ctaLabel = 'Open student profile'
      tgText =
        `🗓 <b>New recurring series</b>\n\n` +
        `<b>${escapeHtml(studentName)}</b> booked you for:\n` +
        `${escapeHtml(patternStr)}\n` +
        `for ${weeks} weeks (${totalLessons} lessons).\n\n` +
        `<a href="${studentUrl}">Open student profile</a>`
    }

    await dispatch(teacher, {
      subject,
      html: emailLayout({
        heading: subject,
        intro,
        detailsHtml: details,
        ctaLabel,
        ctaUrl: studentUrl,
        lang,
      }),
      telegramText: tgText,
    })
  } catch (err) {
    console.error('[sub-events] notifySubscriptionCreated failed', err)
  }
}

// ---------------------------------------------------------------
// 2. Subscription cancelled (full / partial)
// ---------------------------------------------------------------

export async function notifySubscriptionCancelled(
  admin: AdminClient,
  subId: string,
  fromDate?: string | null
): Promise<void> {
  try {
    const sub = await fetchSubscription(admin, subId)
    if (!sub) return

    const teacher = await fetchTeacherInfo(admin, sub.teacher_id)
    if (!teacher) return

    const studentName = await fetchStudentName(admin, sub.student_id)
    const lang = teacher.language
    const patternStr = formatPattern(sub.weekly_pattern || [], lang)
    const studentUrl = `${APP_URL}/teacher/students/${sub.student_id}`
    const isPartial = !!fromDate

    let subject: string
    let intro: string
    let details: string
    let ctaLabel: string
    let tgText: string

    if (lang === 'ru') {
      subject = isPartial
        ? `Серия с ${studentName} отменена с ${formatDateLong(fromDate!, lang)}`
        : `Серия с ${studentName} отменена`
      intro = isPartial
        ? `${studentName} прекращает регулярные занятия начиная с ${formatDateLong(fromDate!, lang)}.`
        : `${studentName} прекратил регулярные занятия. Все будущие уроки серии отменены.`
      details = detailRow('Расписание серии', patternStr)
      if (isPartial) {
        details += detailRow('Заканчивается', formatDateLong(fromDate!, lang))
      }
      ctaLabel = 'Открыть профиль ученика'
      tgText = isPartial
        ? `🛑 <b>Серия уроков прекращается</b>\n\n<b>${escapeHtml(studentName)}</b> прекратил регулярные занятия с <b>${escapeHtml(formatDateLong(fromDate!, lang))}</b>.\n\n${escapeHtml(patternStr)}\n\n<a href="${studentUrl}">Открыть профиль ученика</a>`
        : `🛑 <b>Серия уроков отменена</b>\n\n<b>${escapeHtml(studentName)}</b> прекратил регулярные занятия.\n\nБыло: ${escapeHtml(patternStr)}\n\n<a href="${studentUrl}">Открыть профиль ученика</a>`
    } else {
      subject = isPartial
        ? `${studentName} ends recurring series on ${formatDateLong(fromDate!, lang)}`
        : `${studentName} cancelled the recurring series`
      intro = isPartial
        ? `${studentName} is stopping recurring lessons starting ${formatDateLong(fromDate!, lang)}.`
        : `${studentName} cancelled the recurring series. All future lessons in the series are cancelled.`
      details = detailRow('Series schedule', patternStr)
      if (isPartial) {
        details += detailRow('Ends on', formatDateLong(fromDate!, lang))
      }
      ctaLabel = 'Open student profile'
      tgText = isPartial
        ? `🛑 <b>Recurring series ending</b>\n\n<b>${escapeHtml(studentName)}</b> stops regular lessons from <b>${escapeHtml(formatDateLong(fromDate!, lang))}</b>.\n\n${escapeHtml(patternStr)}\n\n<a href="${studentUrl}">Open student profile</a>`
        : `🛑 <b>Recurring series cancelled</b>\n\n<b>${escapeHtml(studentName)}</b> stopped the recurring series.\n\nWas: ${escapeHtml(patternStr)}\n\n<a href="${studentUrl}">Open student profile</a>`
    }

    await dispatch(teacher, {
      subject,
      html: emailLayout({
        heading: subject,
        intro,
        detailsHtml: details,
        ctaLabel,
        ctaUrl: studentUrl,
        lang,
      }),
      telegramText: tgText,
    })
  } catch (err) {
    console.error('[sub-events] notifySubscriptionCancelled failed', err)
  }
}

// ---------------------------------------------------------------
// 3. Single lesson cancelled
// ---------------------------------------------------------------

export async function notifyLessonCancelled(
  admin: AdminClient,
  lessonId: string,
  cancelledById: string
): Promise<void> {
  try {
    const lesson = await fetchLesson(admin, lessonId)
    if (!lesson) return

    const teacher = await fetchTeacherInfo(admin, lesson.teacher_id)
    if (!teacher) return

    // Если препод сам отменил — не нотифицируем его (нет смысла).
    if (cancelledById === teacher.user_id) {
      console.log(
        `[sub-events] teacher cancelled own lesson — skip self-notify`
      )
      return
    }

    const studentName = await fetchStudentName(admin, lesson.student_id)
    const lang = teacher.language
    const whenStr = formatLessonDateTime(lesson.scheduled_at, lang)
    const scheduleUrl = `${APP_URL}/teacher/schedule`
    const isSeries = !!lesson.subscription_id

    let subject: string
    let intro: string
    let details: string
    let ctaLabel: string
    let tgText: string

    if (lang === 'ru') {
      subject = `Урок ${whenStr} отменён`
      intro = `${studentName} отменил${isSeries ? ' один урок из серии' : ' урок'}.`
      details =
        detailRow('Когда', whenStr) +
        detailRow('Ученик', studentName) +
        detailRow(
          'Длительность',
          `${lesson.duration_minutes ?? 50} мин`
        )
      if (isSeries) {
        details += detailRow(
          'Серия',
          'Остальные уроки серии остаются в силе'
        )
      }
      ctaLabel = 'Открыть расписание'
      tgText =
        `❌ <b>Урок отменён</b>\n\n` +
        `<b>${escapeHtml(studentName)}</b> отменил урок\n` +
        `🕒 ${escapeHtml(whenStr)}\n` +
        (isSeries
          ? `<i>Из регулярной серии — остальные уроки не затронуты.</i>\n\n`
          : `\n`) +
        `<a href="${scheduleUrl}">Открыть расписание</a>`
    } else {
      subject = `Lesson on ${whenStr} cancelled`
      intro = `${studentName} cancelled ${isSeries ? 'one lesson from the series' : 'a lesson'}.`
      details =
        detailRow('When', whenStr) +
        detailRow('Student', studentName) +
        detailRow('Duration', `${lesson.duration_minutes ?? 50} min`)
      if (isSeries) {
        details += detailRow(
          'Series',
          'Other lessons in the series remain active'
        )
      }
      ctaLabel = 'Open schedule'
      tgText =
        `❌ <b>Lesson cancelled</b>\n\n` +
        `<b>${escapeHtml(studentName)}</b> cancelled a lesson\n` +
        `🕒 ${escapeHtml(whenStr)}\n` +
        (isSeries
          ? `<i>From a recurring series — other lessons remain.</i>\n\n`
          : `\n`) +
        `<a href="${scheduleUrl}">Open schedule</a>`
    }

    await dispatch(teacher, {
      subject,
      html: emailLayout({
        heading: subject,
        intro,
        detailsHtml: details,
        ctaLabel,
        ctaUrl: scheduleUrl,
        lang,
      }),
      telegramText: tgText,
    })
  } catch (err) {
    console.error('[sub-events] notifyLessonCancelled failed', err)
  }
}
