// Синхронизация с Google Calendar — только платформа → Google.
//
// Google → платформа намеренно НЕТ: в расписании появляются только уроки, созданные на платформе.
// Событие, добавленное или удалённое в Google, урок не создаёт, не переносит и не отменяет
// (решение владельца, 12.09.2026). Уроки и лекции пишутся в календари через client.ts.
//
// Лекции (pushLectureToGoogle / updateLectureInGoogle / deleteLectureFromGoogle):
// у лекций нет колонки с id события, поэтому событие ищем по private extendedProperty lectureId=<id>.

import { nameKey } from '@/lib/ru/name-match'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deleteEventFromGoogle,
  hasGoogleCalendar,
  listEvents,
  pushEventToGoogle,
  updateEventInGoogle,
} from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

// ------------------------------- Лекции -------------------------------

interface LectureLike { id: string; title: string; host_name: string | null; host_user_id?: string | null; scheduled_at: string; duration_minutes: number | null; tag?: string | null }

/** Учитель-ведущий лекции: по host_user_id, для старых лекций без него — по совпадению имени. */
async function resolveLectureHost(l: Pick<LectureLike, 'host_name' | 'host_user_id'>): Promise<string | null> {
  if (l.host_user_id) return l.host_user_id
  if (!l.host_name) return null
  const admin = createAdminClient() as Db
  // Имя ведущего сравниваем через nameKey (кириллица/латиница, порядок слов) — как в списке лекций.
  const { data } = await admin.from('profiles').select('id, full_name').eq('role', 'teacher')
  const key = nameKey(l.host_name)
  return ((data ?? []) as Array<{ id: string; full_name: string | null }>).find((p) => nameKey(p.full_name ?? '') === key)?.id ?? null
}

/** Ведущий лекции с подключённым Google-календарём (иначе null). */
export async function lectureHostUserId(l: Pick<LectureLike, 'host_name' | 'host_user_id'>): Promise<string | null> {
  const userId = await resolveLectureHost(l)
  if (!userId) return null
  const conn = await hasGoogleCalendar(userId)
  return conn.connected ? userId : null
}

function lectureWindow(l: LectureLike) {
  const startISO = new Date(l.scheduled_at).toISOString()
  const endISO = new Date(Date.parse(startISO) + (l.duration_minutes || 60) * 60_000).toISOString()
  return { startISO, endISO }
}

/** Событие лекции в календаре пользователя (ведущий или записавшийся ученик). */
export async function pushLectureToGoogle(userId: string, l: LectureLike): Promise<string | null> {
  const { startISO, endISO } = lectureWindow(l)
  return pushEventToGoogle(userId, {
    summary: `Лекция: ${l.title}`,
    startISO,
    endISO,
    description: l.tag ? `Лекторий RAW English · ${l.tag}` : 'Лекторий RAW English',
    sendUpdates: 'none',
    extendedProps: { source: 'raw-english', lectureId: l.id },
  })
}

async function findLectureEventIds(userId: string, lectureId: string): Promise<string[]> {
  const now = Date.now()
  const events = await listEvents(userId, new Date(now - 365 * 86400000), new Date(now + 365 * 86400000), { privateExtendedProperty: `lectureId=${lectureId}` }).catch(() => [])
  return events.map((e) => e.id)
}

/** Пользователи, у которых лекция есть в календаре: ведущий + записавшиеся ученики с подключённым Google. */
async function lectureCalendarUsers(l: LectureLike): Promise<string[]> {
  const admin = createAdminClient() as Db
  const ids = new Set<string>()
  const host = await lectureHostUserId(l)
  if (host) ids.add(host)
  const { data: regs } = await admin.from('lecture_registrations').select('student_id').eq('lecture_id', l.id)
  for (const r of (regs ?? []) as Array<{ student_id: string }>) {
    if (r.student_id && (await hasGoogleCalendar(r.student_id)).connected) ids.add(r.student_id)
  }
  return Array.from(ids)
}

export async function updateLectureInGoogle(l: LectureLike): Promise<void> {
  const { startISO, endISO } = lectureWindow(l)
  for (const userId of await lectureCalendarUsers(l)) {
    for (const eventId of await findLectureEventIds(userId, l.id)) {
      await updateEventInGoogle(userId, eventId, { startISO, endISO }).catch(() => false)
    }
  }
}

/** Удалить событие лекции только у одного пользователя (отмена записи). */
export async function deleteLectureFromGoogleForUser(userId: string, lectureId: string): Promise<void> {
  for (const eventId of await findLectureEventIds(userId, lectureId)) {
    await deleteEventFromGoogle(userId, eventId).catch(() => false)
  }
}

export async function deleteLectureFromGoogle(l: LectureLike): Promise<void> {
  for (const userId of await lectureCalendarUsers(l)) {
    for (const eventId of await findLectureEventIds(userId, l.id)) {
      await deleteEventFromGoogle(userId, eventId).catch(() => false)
    }
  }
}
