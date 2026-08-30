"use server"

// ---------------------------------------------------------------------------
// Server actions для создания/отмены уроков учителем.
//
// createLesson():
//   1. Auth-гейт (requireTeacher).
//   2. Валидация studentId + scheduledAt (ISO).
//   3. Проверка занятости слота:
//        a) пересечение с существующими lessons учителя (booked/in_progress/
//           scheduled/confirmed) — жёсткий отказ 'slot_busy_lessons';
//        b) если Google подключён — isSlotBusyInGoogle → 'slot_busy_google'.
//   4. Insert в `lessons` (status='booked', duration=50, price=hourly_rate).
//   5. Если у учителя подключён Google Calendar — push события, id сохраняем
//      в lessons.google_event_id (нужен для cancelLesson → delete из Google).
//   6. revalidateTag(...) — teacher-students + teacher-dashboard.
//   7. Fail-soft: Google-push не откатывает БД-инсерт.
//
// cancelLesson():
//   Проверяет owner (teacher_id === teacher_profiles.id текущего юзера),
//   удаляет строку из lessons; если у урока был google_event_id — параллельно
//   удаляет событие в Google (fail-soft).
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'
import {
  deleteEventFromGoogle,
  hasGoogleCalendar,
  isSlotBusyInGoogle,
  pushEventToGoogle,
} from '@/lib/google-calendar/client'
import { requireTeacher } from '@/lib/teacher/require'
import {
  invalidateTeacherStudents,
  invalidateTeacherDashboard,
} from '@/lib/cache/invalidate'

// google_calendar_* / lessons ещё не полностью в generated Database типах.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

const DEFAULT_DURATION_MIN = 50
const FALLBACK_PRICE_KOPECKS = 100_000

// Статусы, при которых lessons-строка считается «занимающей слот».
// Не включаем cancelled / completed / no_show.
const BUSY_LESSON_STATUSES = ['booked', 'in_progress', 'scheduled', 'confirmed'] as const

export interface CreateLessonInput {
  /** profiles.id студента (auth.uid). */
  studentId: string
  /** ISO-строка (UTC либо с offset). */
  scheduledAt: string
}

export type CreateLessonErrorCode =
  | 'validation'
  | 'slot_busy_lessons'
  | 'slot_busy_google'
  | 'auth'
  | 'db'

export type CreateLessonResult =
  | { ok: true; lessonId: string }
  | { ok: false; error: string; code?: CreateLessonErrorCode }

export async function createLesson(
  input: CreateLessonInput,
): Promise<CreateLessonResult> {
  // ---------- 1. Auth ----------
  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return {
      ok: false,
      code: 'auth',
      error: e instanceof Error ? e.message : 'Unauthorized',
    }
  }

  // ---------- 2. Validation ----------
  if (!input?.studentId || typeof input.studentId !== 'string') {
    return { ok: false, code: 'validation', error: 'Выберите ученика' }
  }
  const startMs = Date.parse(input.scheduledAt)
  if (Number.isNaN(startMs)) {
    return { ok: false, code: 'validation', error: 'Некорректная дата урока' }
  }
  const endMs = startMs + DEFAULT_DURATION_MIN * 60_000
  const startISO = new Date(startMs).toISOString()
  const endISO = new Date(endMs).toISOString()

  const admin = createAdminClient() as UntypedSupabase

  // ---------- 3. Resolve teacher_profiles.id + hourly_rate ----------
  const tpRes = await admin
    .from('teacher_profiles')
    .select('id, hourly_rate')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error) {
    return { ok: false, code: 'db', error: `teacher_profiles: ${tpRes.error.message}` }
  }
  const teacherProfile = tpRes.data as { id: string; hourly_rate: number | null } | null
  if (!teacherProfile) {
    return { ok: false, code: 'db', error: 'teacher_profiles не найден' }
  }
  const price = typeof teacherProfile.hourly_rate === 'number' && teacherProfile.hourly_rate > 0
    ? teacherProfile.hourly_rate
    : FALLBACK_PRICE_KOPECKS

  // ---------- 4. Slot busy: lessons ----------
  // Ищем любой урок этого учителя с активным статусом, что пересекается с
  // [startMs, endMs). Полу-открытый интервал: касание на границе — не конфликт.
  // Тянем окно ±duration от нашего слота, чтобы поймать урок, начавшийся ДО
  // и продолжающийся ПОСЛЕ нашего startMs. Строк в этом окне мало → фильтр в JS.
  const windowFromISO = new Date(startMs - DEFAULT_DURATION_MIN * 60_000).toISOString()
  const windowToISO = new Date(endMs + DEFAULT_DURATION_MIN * 60_000).toISOString()
  const busyRes = await admin
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('teacher_id', teacherProfile.id)
    .in('status', BUSY_LESSON_STATUSES as unknown as string[])
    .gte('scheduled_at', windowFromISO)
    .lte('scheduled_at', windowToISO)
  if (busyRes.error) {
    return { ok: false, code: 'db', error: `lessons check: ${busyRes.error.message}` }
  }
  const rows = (busyRes.data ?? []) as Array<{
    id: string
    scheduled_at: string
    duration_minutes: number | null
    status: string
  }>
  for (const r of rows) {
    const s = Date.parse(r.scheduled_at)
    if (!Number.isFinite(s)) continue
    const dur = typeof r.duration_minutes === 'number' && r.duration_minutes > 0
      ? r.duration_minutes
      : DEFAULT_DURATION_MIN
    const e = s + dur * 60_000
    if (s < endMs && e > startMs) {
      return {
        ok: false,
        code: 'slot_busy_lessons',
        error: 'В это время уже есть урок',
      }
    }
  }

  // ---------- 5. Resolve student full_name (для Google summary + возврата) ----------
  const stuRes = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', input.studentId)
    .maybeSingle()
  if (stuRes.error) {
    return { ok: false, code: 'db', error: `profiles: ${stuRes.error.message}` }
  }
  const student = stuRes.data as { id: string; full_name: string | null; role: string | null } | null
  if (!student) {
    return { ok: false, code: 'validation', error: 'Ученик не найден' }
  }

  // ---------- 6. Slot busy: Google Calendar ----------
  // Ходим в Google ТОЛЬКО если подключён. Fail-soft внутри isSlotBusyInGoogle
  // (сетевые ошибки → false), поэтому падение API не блокирует пользователя.
  const conn = await hasGoogleCalendar(auth.userId)
  if (conn.connected) {
    const gBusy = await isSlotBusyInGoogle(auth.userId, startISO, endISO)
    if (gBusy) {
      return {
        ok: false,
        code: 'slot_busy_google',
        error: 'В это время в вашем Google Calendar уже есть событие',
      }
    }
  }

  // ---------- 7. Insert lessons row ----------
  const insertRes = await admin
    .from('lessons')
    .insert({
      student_id: input.studentId,
      teacher_id: teacherProfile.id,
      scheduled_at: startISO,
      duration_minutes: DEFAULT_DURATION_MIN,
      status: 'booked',
      price,
    })
    .select('id')
    .single()
  if (insertRes.error || !insertRes.data) {
    return {
      ok: false,
      code: 'db',
      error: `insert lessons: ${insertRes.error?.message ?? 'unknown'}`,
    }
  }
  const lessonId = (insertRes.data as { id: string }).id

  // ---------- 8. Mirror to Google Calendar (fail-soft) ----------
  if (conn.connected) {
    try {
      const summary = `Урок с ${student.full_name || 'учеником'}`
      const eventId = await pushEventToGoogle(auth.userId, {
        summary,
        startISO,
        endISO,
        extendedProps: {
          source: 'raw-english',
          lessonId,
        },
      })
      if (eventId) {
        // Сохраняем event id в lessons.google_event_id, чтобы cancelLesson
        // мог параллельно удалить событие в Google.
        const upd = await admin
          .from('lessons')
          .update({ google_event_id: eventId })
          .eq('id', lessonId)
        if (upd.error) {
          console.error('[createLesson] persist google_event_id failed', upd.error)
        }
      }
    } catch (e) {
      // Не откатываем DB-инсерт: логируем и продолжаем.
      console.error('[createLesson] Google push failed', e)
    }
  }

  // ---------- 9. Invalidate dashboard cache ----------
  invalidateTeacherStudents(auth.userId)
  invalidateTeacherDashboard(auth.userId)

  return { ok: true, lessonId }
}

// ---------------------------------------------------------------------------
// cancelLesson
// ---------------------------------------------------------------------------

export interface CancelLessonInput {
  lessonId: string
}

export type CancelLessonResult =
  | { ok: true }
  | { ok: false; error: string }

export async function cancelLesson(
  { lessonId }: CancelLessonInput,
): Promise<CancelLessonResult> {
  if (!lessonId || typeof lessonId !== 'string') {
    return { ok: false, error: 'lessonId is required' }
  }

  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const admin = createAdminClient() as UntypedSupabase

  // Резолвим teacher_profiles.id — это teacher_id в lessons.
  const tpRes = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error) {
    return { ok: false, error: `teacher_profiles: ${tpRes.error.message}` }
  }
  const teacherPk = (tpRes.data as { id: string } | null)?.id
  if (!teacherPk) return { ok: false, error: 'teacher_profiles not found' }

  // Загружаем урок для owner-проверки + чтобы узнать google_event_id.
  const lessonRes = await admin
    .from('lessons')
    .select('id, teacher_id, google_event_id')
    .eq('id', lessonId)
    .maybeSingle()
  if (lessonRes.error) {
    return { ok: false, error: `lessons load: ${lessonRes.error.message}` }
  }
  const lesson = lessonRes.data as {
    id: string
    teacher_id: string
    google_event_id: string | null
  } | null
  if (!lesson) return { ok: false, error: 'Урок не найден' }
  if (lesson.teacher_id !== teacherPk) {
    return { ok: false, error: 'Forbidden: not lesson owner' }
  }

  // Параллельно: удаляем строку из lessons + удаляем event в Google (fail-soft).
  const [delRes] = await Promise.all([
    admin.from('lessons').delete().eq('id', lessonId),
    lesson.google_event_id
      ? deleteEventFromGoogle(auth.userId, lesson.google_event_id)
      : Promise.resolve(false),
  ])
  if (delRes.error) {
    return { ok: false, error: `delete lessons: ${delRes.error.message}` }
  }

  invalidateTeacherStudents(auth.userId)
  invalidateTeacherDashboard(auth.userId)

  return { ok: true }
}
