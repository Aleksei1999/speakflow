"use server"

// ---------------------------------------------------------------------------
// Server actions для Google Calendar-интеграции в teacher-дашборде.
//
// ВАЖНО (рефактор 2026-08-12):
//   Раньше `fetchTeacherSchedule()` объединяла события Google Calendar
//   (кеш `google_calendar_events`) с записями из `lessons`. Сейчас интеграция
//   работает в одну сторону: мы ПИШЕМ уроки в Google (см. lesson-actions.ts
//   → pushEventToGoogle), но НЕ читаем оттуда события обратно. Причины:
//     • избегаем дубликатов и рассинхронизации таймзон;
//     • источник истины теперь только `lessons`.
//   Поэтому `fetchTeacherSchedule()` читает только `lessons`, а
//   `syncGoogleCalendar()` оставлен как deprecated-стаб для отладки.
//
// Экспортируем:
//   • fetchTeacherSchedule()    — только `lessons`, нормализованы в ScheduleItem.
//   • syncGoogleCalendar()      — DEPRECATED: no-op стаб, {skipped: true}.
//   • getCalendarConnection()   — статус подключения (для CTA-баннера).
//   • disconnectGoogleCalendar()— удалить токены.
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import { hasGoogleCalendar } from '@/lib/google-calendar/client'
import { requireTeacher, tryGetTeacher } from '@/lib/teacher/require'

// google_calendar_tokens не в generated Database типах — свежая миграция.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

export type ScheduleSource = 'google' | 'lesson'

export interface ScheduleItem {
  id: string
  source: ScheduleSource
  title: string
  description: string | null
  startAt: string   // ISO
  endAt: string     // ISO
  location: string | null
  meetingUrl: string | null
  studentId: string | null
  studentName: string | null
  studentAvatar: string | null
  /** Только для source='lesson'. */
  status?: string | null
}

// Окно чтения расписания: -7 дней..+30 дней от сейчас.
const SCHEDULE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
const SCHEDULE_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000

// ---------- Google → БД ----------

/**
 * DEPRECATED. Раньше тянул события учителя из Google и upsert-ил в кеш.
 * Сейчас чтение из Google выключено (см. заголовок файла). Оставлено как
 * no-op стаб, чтобы старые вызовы (например, ручной триггер из devtools)
 * не падали. Всегда возвращает `{skipped: true}`.
 */
export async function syncGoogleCalendar(): Promise<{ synced: number } | { skipped: true }> {
  // Проверим auth чтобы не быть открытым endpoint-ом, но реальную работу
  // больше не делаем.
  try {
    await requireTeacher()
  } catch {
    /* даже auth-ошибку молча съедаем — это deprecated путь */
  }
  return { skipped: true }
}

// ---------- Расписание из `lessons` ----------

interface LessonRow {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  student_id: string | null
  jitsi_room_name: string | null
}

/**
 * Возвращает расписание учителя за -7d..+30d.
 * Читаем только `lessons` (Google Calendar-события больше не мерджим — см.
 * заголовок файла). Если пользователь не залогинен (preview) — вернём [].
 */
export async function fetchTeacherSchedule(): Promise<ScheduleItem[]> {
  const auth = await tryGetTeacher()
  if (!auth) return []
  const { supabase, userId } = auth

  const now = Date.now()
  const from = new Date(now - SCHEDULE_LOOKBACK_MS).toISOString()
  const to = new Date(now + SCHEDULE_LOOKAHEAD_MS).toISOString()

  // teacher_profiles.id — это teacher_id в lessons.
  const tp = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const teacherPk = (tp.data as { id: string } | null)?.id
  if (!teacherPk) return []

  const lessonsRes = await supabase
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, status, student_id, jitsi_room_name')
    .eq('teacher_id', teacherPk)
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
  if (lessonsRes.error) {
    throw new Error(`fetchTeacherSchedule (lessons): ${lessonsRes.error.message}`)
  }

  const lessonRows = (lessonsRes.data ?? []) as LessonRow[]

  // Резолвим имена + аватары учеников одним batch-запросом.
  const studentIds = Array.from(
    new Set(lessonRows.map((l) => l.student_id).filter((x): x is string => !!x)),
  )
  const studentInfo = new Map<string, { name: string | null; avatar: string | null }>()
  if (studentIds.length > 0) {
    const { data: ppl } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', studentIds)
    for (const p of (ppl ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
      studentInfo.set(p.id, { name: p.full_name, avatar: p.avatar_url })
    }
  }

  const items: ScheduleItem[] = []
  for (const l of lessonRows) {
    const startMs = new Date(l.scheduled_at).getTime()
    const endMs = startMs + (l.duration_minutes ?? 50) * 60_000
    const info = l.student_id ? studentInfo.get(l.student_id) : undefined
    const studentName = info?.name ?? null
    items.push({
      id: `lesson:${l.id}`,
      source: 'lesson',
      title: studentName ? `Урок с ${studentName}` : 'Урок',
      description: null,
      startAt: l.scheduled_at,
      endAt: new Date(endMs).toISOString(),
      location: null,
      meetingUrl: l.jitsi_room_name ? `/lesson/${l.id}` : null,
      studentId: l.student_id,
      studentName,
      studentAvatar: info?.avatar ?? null,
      status: l.status,
    })
  }

  items.sort((a, b) => a.startAt.localeCompare(b.startAt))
  return items
}

// ---------- Статус подключения ----------

export interface CalendarConnection {
  connected: boolean
  googleEmail: string | null
  syncedAt: string | null
}

/**
 * Дёшево проверяет, привязан ли у учителя Google Calendar.
 * Не читает access/refresh — только view `google_calendar_status`.
 */
export async function getCalendarConnection(): Promise<CalendarConnection> {
  const auth = await tryGetTeacher()
  if (!auth) return { connected: false, googleEmail: null, syncedAt: null }
  return hasGoogleCalendar(auth.userId)
}

// ---------- Отключение (bonus, минимальный) ----------

export async function disconnectGoogleCalendar(): Promise<{ ok: true }> {
  const auth = await requireTeacher()
  const admin = createAdminClient() as UntypedSupabase
  const { error } = await admin
    .from('google_calendar_tokens')
    .delete()
    .eq('user_id', auth.userId)
  if (error) throw new Error(`disconnectGoogleCalendar: ${error.message}`)
  return { ok: true }
}
