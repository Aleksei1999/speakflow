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
  updateEventInGoogle,
} from '@/lib/google-calendar/client'
import { requireTeacher } from '@/lib/teacher/require'
import {
  invalidateTeacherStudents,
  invalidateTeacherDashboard,
  invalidateStudentDashboard,
} from '@/lib/cache/invalidate'
import { notifyLessonRescheduled } from '@/lib/notifications/booking'

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

  // ---------- 5. Resolve student full_name + email (для Google summary/attendees) ----------
  const stuRes = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', input.studentId)
    .maybeSingle()
  if (stuRes.error) {
    return { ok: false, code: 'db', error: `profiles: ${stuRes.error.message}` }
  }
  const student = stuRes.data as { id: string; full_name: string | null; email: string | null; role: string | null } | null
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
        attendees: student.email
          ? [{ email: student.email, displayName: student.full_name || undefined }]
          : undefined,
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
  // Ученик тоже должен увидеть новый урок → сбрасываем его снапшот.
  invalidateStudentDashboard(input.studentId)

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
    .select('id, teacher_id, student_id, google_event_id')
    .eq('id', lessonId)
    .maybeSingle()
  if (lessonRes.error) {
    return { ok: false, error: `lessons load: ${lessonRes.error.message}` }
  }
  const lesson = lessonRes.data as {
    id: string
    teacher_id: string
    student_id: string | null
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
  if (lesson.student_id) invalidateStudentDashboard(lesson.student_id)

  return { ok: true }
}

// ---------------------------------------------------------------------------
// rescheduleLesson
//
// Обновляет lessons.scheduled_at существующего урока. Owner-check по
// teacher_profiles.id === lesson.teacher_id. Проверка занятости слота ИСКЛЮЧАЕТ
// сам редактируемый урок (иначе он бы конфликтовал сам с собой).
// Google Calendar event синхронизируется PATCH-ом (fail-soft) с sendUpdates=all
// — ученику придёт email об изменении времени.
// ---------------------------------------------------------------------------

export interface RescheduleLessonInput {
  lessonId: string
  /** ISO-строка (UTC либо с offset). Длительность урока не меняем. */
  scheduledAt: string
}

export type RescheduleLessonErrorCode =
  | 'validation'
  | 'slot_busy_lessons'
  | 'slot_busy_google'
  | 'auth'
  | 'db'
  | 'not_found'
  | 'forbidden'

export type RescheduleLessonResult =
  | { ok: true }
  | { ok: false; error: string; code?: RescheduleLessonErrorCode }

export async function rescheduleLesson(
  input: RescheduleLessonInput,
): Promise<RescheduleLessonResult> {
  if (!input?.lessonId || typeof input.lessonId !== 'string') {
    return { ok: false, code: 'validation', error: 'lessonId is required' }
  }
  const startMs = Date.parse(input.scheduledAt)
  if (Number.isNaN(startMs)) {
    return { ok: false, code: 'validation', error: 'Некорректная дата урока' }
  }

  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return { ok: false, code: 'auth', error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const admin = createAdminClient() as UntypedSupabase

  const tpRes = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error) {
    return { ok: false, code: 'db', error: `teacher_profiles: ${tpRes.error.message}` }
  }
  const teacherPk = (tpRes.data as { id: string } | null)?.id
  if (!teacherPk) return { ok: false, code: 'db', error: 'teacher_profiles not found' }

  const lessonRes = await admin
    .from('lessons')
    .select('id, teacher_id, student_id, duration_minutes, google_event_id, scheduled_at')
    .eq('id', input.lessonId)
    .maybeSingle()
  if (lessonRes.error) {
    return { ok: false, code: 'db', error: `lessons load: ${lessonRes.error.message}` }
  }
  const lesson = lessonRes.data as {
    id: string
    teacher_id: string
    student_id: string | null
    duration_minutes: number | null
    google_event_id: string | null
    scheduled_at: string
  } | null
  if (!lesson) return { ok: false, code: 'not_found', error: 'Урок не найден' }
  if (lesson.teacher_id !== teacherPk) {
    return { ok: false, code: 'forbidden', error: 'Forbidden: not lesson owner' }
  }

  const duration = typeof lesson.duration_minutes === 'number' && lesson.duration_minutes > 0
    ? lesson.duration_minutes
    : DEFAULT_DURATION_MIN
  const endMs = startMs + duration * 60_000
  const startISO = new Date(startMs).toISOString()
  const endISO = new Date(endMs).toISOString()

  // Слот занят другими уроками этого учителя? (текущий урок исключаем).
  const windowFromISO = new Date(startMs - duration * 60_000).toISOString()
  const windowToISO = new Date(endMs + duration * 60_000).toISOString()
  const busyRes = await admin
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('teacher_id', teacherPk)
    .in('status', BUSY_LESSON_STATUSES as unknown as string[])
    .gte('scheduled_at', windowFromISO)
    .lte('scheduled_at', windowToISO)
    .neq('id', input.lessonId)
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
      return { ok: false, code: 'slot_busy_lessons', error: 'В это время уже есть другой урок' }
    }
  }

  // Google Calendar busy — только если подключён.
  const conn = await hasGoogleCalendar(auth.userId)
  if (conn.connected) {
    const gBusy = await isSlotBusyInGoogle(auth.userId, startISO, endISO)
    if (gBusy) {
      // Если событие принадлежит нам (google_event_id совпадает), Google вернёт
      // его как busy — но это не конфликт, а сам урок. isSlotBusyInGoogle этого
      // не знает; поэтому если у нас google_event_id есть и busy=true, доверяем
      // тому что конфликт возможен и всё равно пропускаем: часто это сам урок.
      // Fail-safe: не блокируем, если есть google_event_id (значит конфликт может
      // быть с самим собой). Иначе — блокируем.
      if (!lesson.google_event_id) {
        return { ok: false, code: 'slot_busy_google', error: 'В это время в вашем Google Calendar уже есть событие' }
      }
    }
  }

  // Обновляем БД.
  const updRes = await admin
    .from('lessons')
    .update({ scheduled_at: startISO })
    .eq('id', input.lessonId)
  if (updRes.error) {
    return { ok: false, code: 'db', error: `update lessons: ${updRes.error.message}` }
  }

  // Google Calendar sync (fail-soft): PATCH события с новыми start/end.
  if (conn.connected && lesson.google_event_id) {
    try {
      await updateEventInGoogle(auth.userId, lesson.google_event_id, {
        startISO,
        endISO,
        sendUpdates: 'all',
      })
    } catch (e) {
      console.error('[rescheduleLesson] Google patch failed', e)
    }
  }

  invalidateTeacherStudents(auth.userId)
  invalidateTeacherDashboard(auth.userId)
  if (lesson.student_id) invalidateStudentDashboard(lesson.student_id)

  // Уведомление другой стороне (обычно ученику). Fire-and-forget,
  // чтобы email/telegram не блокировали ответ UI. Пропускаем, если
  // время фактически не поменялось.
  if (lesson.scheduled_at !== startISO) {
    void notifyLessonRescheduled({
      lessonId: input.lessonId,
      oldScheduledAt: lesson.scheduled_at,
      changedByUserId: auth.userId,
    }).catch(() => {})
  }

  return { ok: true }
}
