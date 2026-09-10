// Двусторонняя синхронизация с Google Calendar.
//
// Google → платформа (syncTeacherFromGoogle):
//   • чужие события с учеником среди гостей → INSERT/UPDATE в lessons (google_event_id = event.id);
//   • наши события (source='raw-english'), сдвинутые в Google → переносим урок и событие ученика;
//   • удалённые в Google события (status='cancelled') → урок на платформе отменяется, событие у ученика удаляется.
// Запускается кроном /api/internal/cron/google-calendar-sync и «по требованию» при открытии кабинета
// (syncIfStale / syncStaleTeachers), чтобы не зависеть от расписания крона.
//
// Платформа → Google для лекций (pushLectureToGoogle / updateLectureInGoogle / deleteLectureFromGoogle):
// у лекций нет колонки с id события, поэтому событие ищем по private extendedProperty lectureId=<id>.

import { nameKey } from '@/lib/ru/name-match'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deleteEventFromGoogle,
  hasGoogleCalendar,
  listEvents,
  markSynced,
  pushEventToGoogle,
  updateEventInGoogle,
} from './client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface TeacherSyncResult {
  teacherUserId: string
  imported: number
  updated: number
  cancelled: number
  errors: string[]
}

const LOOKBACK_MS = 24 * 60 * 60 * 1000
const HORIZON_MS = 30 * 24 * 60 * 60 * 1000

/** Синхронизирует календарь одного учителя (по user_id). Fail-soft: ошибки собираются в result.errors. */
async function syncTeacherFromGoogle(teacherUserId: string): Promise<TeacherSyncResult> {
  const admin = createAdminClient() as Db
  const result: TeacherSyncResult = { teacherUserId, imported: 0, updated: 0, cancelled: 0, errors: [] }

  const { data: tp } = await admin.from('teacher_profiles').select('id').eq('user_id', teacherUserId).maybeSingle()
  const teacherProfileId = (tp as { id: string } | null)?.id
  if (!teacherProfileId) return result

  const now = Date.now()
  let events: Awaited<ReturnType<typeof listEvents>> = []
  try {
    events = await listEvents(teacherUserId, new Date(now - LOOKBACK_MS), new Date(now + HORIZON_MS), { includeCancelled: true })
  } catch (e) {
    result.errors.push(`list: ${e instanceof Error ? e.message : String(e)}`)
    return result
  }

  const eventIds = events.map((e) => e.id)
  const { data: existingRows } = eventIds.length
    ? await admin
        .from('lessons')
        .select('id, google_event_id, student_google_event_id, student_id, scheduled_at, duration_minutes, status')
        .eq('teacher_id', teacherProfileId)
        .in('google_event_id', eventIds)
    : { data: [] as Db[] }
  const existingByGid = new Map<string, Db>(((existingRows ?? []) as Db[]).map((l) => [l.google_event_id, l]))

  // --- удалённые в Google → отмена урока на платформе ---
  for (const ev of events) {
    if (ev.status !== 'cancelled') continue
    const lesson = existingByGid.get(ev.id)
    if (!lesson || lesson.status === 'cancelled' || lesson.status === 'completed') continue
    const { error } = await admin
      .from('lessons')
      .update({ status: 'cancelled', cancelled_by: null, cancellation_reason: 'Удалено в Google Calendar' })
      .eq('id', lesson.id)
    if (error) { result.errors.push(`cancel ${lesson.id}: ${error.message}`); continue }
    result.cancelled++
    if (lesson.student_id && lesson.student_google_event_id) {
      await deleteEventFromGoogle(lesson.student_id, lesson.student_google_event_id).catch(() => false)
    }
  }

  const live = events.filter((e) => e.status !== 'cancelled' && !!e.start?.dateTime && !!e.end?.dateTime)

  // --- наши события, сдвинутые в Google → переносим урок и событие ученика ---
  for (const ev of live) {
    if (ev.extendedProperties?.private?.source !== 'raw-english') continue
    const lesson = existingByGid.get(ev.id)
    if (!lesson || lesson.status === 'cancelled' || lesson.status === 'completed') continue
    const startISO = ev.start!.dateTime!
    const endISO = ev.end!.dateTime!
    const durationMinutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60_000))
    if (Date.parse(lesson.scheduled_at) === Date.parse(startISO) && lesson.duration_minutes === durationMinutes) continue
    const { error } = await admin.from('lessons').update({ scheduled_at: startISO, duration_minutes: durationMinutes }).eq('id', lesson.id)
    if (error) { result.errors.push(`move ${lesson.id}: ${error.message}`); continue }
    result.updated++
    if (lesson.student_id && lesson.student_google_event_id) {
      await updateEventInGoogle(lesson.student_id, lesson.student_google_event_id, { startISO, endISO }).catch(() => false)
    }
  }

  // --- чужие события с учеником среди гостей → импорт / перенос ---
  const candidates = live.filter((e) => e.extendedProperties?.private?.source !== 'raw-english')
  const emails = new Set<string>()
  for (const e of candidates) for (const a of e.attendees ?? []) if (a.email) emails.add(a.email.toLowerCase())
  if (candidates.length && emails.size) {
    const { data: studentRows } = await admin.from('profiles').select('id, email, role').in('email', Array.from(emails)).eq('role', 'student')
    const studentByEmail = new Map<string, string>(((studentRows ?? []) as Db[]).map((p) => [String(p.email).toLowerCase(), p.id]))
    for (const ev of candidates) {
      let studentId: string | null = null
      for (const a of ev.attendees ?? []) {
        const sid = a.email ? studentByEmail.get(a.email.toLowerCase()) : undefined
        if (sid) { studentId = sid; break }
      }
      if (!studentId) continue
      const startISO = ev.start!.dateTime!
      const endISO = ev.end!.dateTime!
      const durationMinutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60_000))
      const existing = existingByGid.get(ev.id)
      if (existing) {
        if (Date.parse(existing.scheduled_at) !== Date.parse(startISO) || existing.duration_minutes !== durationMinutes) {
          const { error } = await admin.from('lessons').update({ scheduled_at: startISO, duration_minutes: durationMinutes }).eq('id', existing.id)
          if (error) result.errors.push(`update ${existing.id}: ${error.message}`); else result.updated++
        }
      } else {
        const { error } = await admin.from('lessons').insert({
          student_id: studentId,
          teacher_id: teacherProfileId,
          scheduled_at: startISO,
          duration_minutes: durationMinutes,
          status: 'booked',
          price: 0,
          google_event_id: ev.id,
          jitsi_room_name: null,
          cancelled_by: null,
          cancellation_reason: null,
          teacher_notes: null,
        })
        if (error) {
          if (error.code === '23P01' || error.code === '23505') continue // слот занят / дубль
          result.errors.push(`insert gid=${ev.id}: ${error.message}`)
        } else result.imported++
      }
    }
  }

  await markSynced(teacherUserId).catch(() => {})
  return result
}

/** Все подключённые учителя подряд (крон). */
export async function syncAllTeachersFromGoogle(): Promise<TeacherSyncResult[]> {
  const admin = createAdminClient() as Db
  const { data: tokens } = await admin.from('google_calendar_tokens').select('user_id')
  const out: TeacherSyncResult[] = []
  for (const t of (tokens ?? []) as Array<{ user_id: string }>) {
    try { out.push(await syncTeacherFromGoogle(t.user_id)) }
    catch (e) { out.push({ teacherUserId: t.user_id, imported: 0, updated: 0, cancelled: 0, errors: [e instanceof Error ? e.message : String(e)] }) }
  }
  return out
}

/** Синхронизация «по требованию»: если календарь подключён и с прошлой синхронизации прошло больше maxAgeMs. */
export async function syncIfStale(teacherUserId: string, maxAgeMs = 10 * 60 * 1000): Promise<TeacherSyncResult | null> {
  const admin = createAdminClient() as Db
  const { data } = await admin.from('google_calendar_tokens').select('synced_at').eq('user_id', teacherUserId).maybeSingle()
  if (!data) return null
  const last = (data as { synced_at: string | null }).synced_at
  if (last && Date.now() - Date.parse(last) < maxAgeMs) return null
  const res = await syncTeacherFromGoogle(teacherUserId)
  if (res.errors.length) console.error('[gcal-sync] on-demand', teacherUserId, res.errors)
  return res
}

/** Для админки: все учителя, у кого синхронизация старше maxAgeMs. */
export async function syncStaleTeachers(maxAgeMs = 10 * 60 * 1000): Promise<TeacherSyncResult[]> {
  const admin = createAdminClient() as Db
  const { data: tokens } = await admin.from('google_calendar_tokens').select('user_id, synced_at')
  const out: TeacherSyncResult[] = []
  for (const t of (tokens ?? []) as Array<{ user_id: string; synced_at: string | null }>) {
    if (t.synced_at && Date.now() - Date.parse(t.synced_at) < maxAgeMs) continue
    try { out.push(await syncTeacherFromGoogle(t.user_id)) } catch (e) { out.push({ teacherUserId: t.user_id, imported: 0, updated: 0, cancelled: 0, errors: [String(e)] }) }
  }
  for (const r of out) if (r.errors.length) console.error('[gcal-sync] stale teachers', r.teacherUserId, r.errors)
  return out
}

/** Не даём синхронизации задержать рендер страницы дольше timeoutMs — она продолжится в фоне. */
export function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))])
}

// ------------------------------- Лекции -------------------------------

interface LectureLike { id: string; title: string; host_name: string | null; scheduled_at: string; duration_minutes: number | null; tag?: string | null }

/** Учитель-ведущий лекции по host_name (у лекций нет id ведущего). Возвращает user_id, если календарь подключён. */
export async function lectureHostUserId(hostName: string | null): Promise<string | null> {
  if (!hostName) return null
  const admin = createAdminClient() as Db
  // Имя ведущего сравниваем через nameKey (кириллица/латиница, порядок слов) — как в списке лекций.
  const { data } = await admin.from('profiles').select('id, full_name').eq('role', 'teacher')
  const key = nameKey(hostName)
  const userId = ((data ?? []) as Array<{ id: string; full_name: string | null }>).find((p) => nameKey(p.full_name ?? '') === key)?.id
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
  const host = await lectureHostUserId(l.host_name)
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
