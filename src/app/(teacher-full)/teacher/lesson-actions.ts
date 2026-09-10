"use server"

// Server actions учителя: создание / отмена / перенос уроков с проверкой
// занятости слота (lessons + Google Calendar) и зеркалированием в Google
// (fail-soft: ошибки Google не откатывают БД).

import { teacherHasStudent } from '@/lib/materials/access'
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
import { notifyLessonRescheduled, notifyLessonCancelled } from '@/lib/notifications/booking'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

const DEFAULT_DURATION_MIN = 50
const FALLBACK_PRICE_KOPECKS = 100_000

// Статусы, при которых lessons-строка считается «занимающей слот».
// Не включаем cancelled / completed / no_show.
const BUSY_LESSON_STATUSES = ['booked', 'in_progress', 'pending_payment', 'scheduled', 'confirmed'] as const
// Статусы, из которых урок можно переносить.
const RESCHEDULABLE_STATUSES = new Set(['booked', 'pending_payment', 'in_progress'])

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

  if (!input?.studentId || typeof input.studentId !== 'string') {
    return { ok: false, code: 'validation', error: 'Выберите ученика' }
  }
  const startMs = Date.parse(input.scheduledAt)
  if (Number.isNaN(startMs)) {
    return { ok: false, code: 'validation', error: 'Некорректная дата урока' }
  }
  if (startMs < Date.now() - 60_000) {
    return { ok: false, code: 'validation', error: 'Нельзя создать урок в прошлом' }
  }
  const endMs = startMs + DEFAULT_DURATION_MIN * 60_000
  const startISO = new Date(startMs).toISOString()
  const endISO = new Date(endMs).toISOString()

  const admin = createAdminClient() as UntypedSupabase

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
  if (student.role !== 'student') {
    return { ok: false, code: 'validation', error: 'Урок можно назначить только ученику' }
  }
  if (!(await teacherHasStudent(admin, teacherProfile.id, input.studentId))) {
    return { ok: false, code: 'validation', error: 'Это не ваш ученик — ученика назначает админ' }
  }

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

  // Зеркалим в Google Calendar (fail-soft).
  if (conn.connected) {
    try {
      const summary = `Урок с ${student.full_name || 'учеником'}`
      // Если у ученика подключён свой календарь — событие пушим туда отдельно,
      // а не приглашаем attendee (иначе у него будет два события).
      const studentHasCal = (await hasGoogleCalendar(student.id)).connected
      const eventId = await pushEventToGoogle(auth.userId, {
        summary,
        startISO,
        endISO,
        attendees: !studentHasCal && student.email
          ? [{ email: student.email, displayName: student.full_name || undefined }]
          : undefined,
        extendedProps: {
          source: 'raw-english',
          lessonId,
        },
      })
      if (eventId) {
        // google_event_id нужен cancelLesson, чтобы удалить событие в Google.
        const upd = await admin
          .from('lessons')
          .update({ google_event_id: eventId })
          .eq('id', lessonId)
        if (upd.error) {
          console.error('[createLesson] persist google_event_id failed', upd.error)
        }
      }
      // И в личный календарь ученика, если он подключён
      if (studentHasCal) {
        const { data: teaProf } = await admin.from('profiles').select('full_name').eq('id', auth.userId).maybeSingle()
        const studentEventId = await pushEventToGoogle(student.id, {
          summary: `Урок с ${(teaProf as { full_name: string | null } | null)?.full_name || 'преподавателем'}`,
          startISO,
          endISO,
          extendedProps: { source: 'raw-english', lessonId, side: 'student' },
        })
        if (studentEventId) await admin.from('lessons').update({ student_google_event_id: studentEventId }).eq('id', lessonId)
      }
    } catch (e) {
      // Не откатываем DB-инсерт: логируем и продолжаем.
      console.error('[createLesson] Google push failed', e)
    }
  }

  invalidateTeacherStudents(auth.userId)
  invalidateTeacherDashboard(auth.userId)
  // Ученик тоже должен увидеть новый урок → сбрасываем его снапшот.
  invalidateStudentDashboard(input.studentId)

  return { ok: true, lessonId }
}

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
  const teacherPk = (tpRes.data as { id: string } | null)?.id ?? null
  // Админ (без teacher_profiles) может отменить любой урок — например, только что созданный из админки.
  let isAdmin = false
  if (!teacherPk) {
    const roleRes = await admin.from('profiles').select('role').eq('id', auth.userId).maybeSingle()
    isAdmin = (roleRes.data as { role: string | null } | null)?.role === 'admin'
    if (!isAdmin) return { ok: false, error: 'teacher_profiles not found' }
  }

  // Загружаем урок для owner-проверки + чтобы узнать google_event_id.
  const lessonRes = await admin
    .from('lessons')
    .select('id, teacher_id, student_id, google_event_id, student_google_event_id, status')
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
    student_google_event_id: string | null
    status: string | null
  } | null
  if (!lesson) return { ok: false, error: 'Урок не найден' }
  if (!isAdmin && lesson.teacher_id !== teacherPk) {
    return { ok: false, error: 'Forbidden: not lesson owner' }
  }
  let ownerUserId = auth.userId
  if (isAdmin) {
    const ownerRes = await admin.from('teacher_profiles').select('user_id').eq('id', lesson.teacher_id).maybeSingle()
    ownerUserId = (ownerRes.data as { user_id: string } | null)?.user_id ?? auth.userId
  }

  if (lesson.status === 'cancelled') return { ok: true }
  if (lesson.status === 'completed' || lesson.status === 'no_show') {
    return { ok: false, error: `Нельзя отменить урок со статусом ${lesson.status}` }
  }

  // Мягкая отмена (история, оплаты и аудит сохраняются) + удаляем события
  // в Google у учителя и у ученика (fail-soft).
  const [delRes] = await Promise.all([
    admin
      .from('lessons')
      .update({ status: 'cancelled', cancelled_by: auth.userId, google_event_id: null, student_google_event_id: null })
      .eq('id', lessonId),
    lesson.google_event_id
      ? deleteEventFromGoogle(ownerUserId, lesson.google_event_id).catch(() => false)
      : Promise.resolve(false),
    lesson.student_id && lesson.student_google_event_id
      ? deleteEventFromGoogle(lesson.student_id, lesson.student_google_event_id).catch(() => false)
      : Promise.resolve(false),
  ])
  if (delRes.error) {
    return { ok: false, error: `cancel lessons: ${delRes.error.message}` }
  }
  void notifyLessonCancelled({ lessonId, cancelledByUserId: auth.userId }).catch(() => {})

  invalidateTeacherStudents(ownerUserId)
  invalidateTeacherDashboard(ownerUserId)
  if (lesson.student_id) invalidateStudentDashboard(lesson.student_id)

  return { ok: true }
}

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
  let teacherPk = (tpRes.data as { id: string } | null)?.id ?? null
  // Админ (без teacher_profiles) может переносить любой урок — он правит расписание школы.
  let isAdmin = false
  if (!teacherPk) {
    const roleRes = await admin.from('profiles').select('role').eq('id', auth.userId).maybeSingle()
    isAdmin = (roleRes.data as { role: string | null } | null)?.role === 'admin'
    if (!isAdmin) return { ok: false, code: 'db', error: 'teacher_profiles not found' }
  }

  const lessonRes = await admin
    .from('lessons')
    .select('id, teacher_id, student_id, duration_minutes, google_event_id, student_google_event_id, scheduled_at, status')
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
    student_google_event_id: string | null
    scheduled_at: string
    status: string | null
  } | null
  if (!lesson) return { ok: false, code: 'not_found', error: 'Урок не найден' }
  if (!RESCHEDULABLE_STATUSES.has(lesson.status ?? '')) {
    return { ok: false, code: 'validation', error: `Нельзя перенести урок со статусом ${lesson.status}` }
  }
  if (startMs < Date.now() - 60_000) {
    return { ok: false, code: 'validation', error: 'Нельзя перенести урок в прошлое' }
  }
  if (!isAdmin && lesson.teacher_id !== teacherPk) {
    return { ok: false, code: 'forbidden', error: 'Forbidden: not lesson owner' }
  }
  if (isAdmin) teacherPk = lesson.teacher_id
  // Google Calendar и кэши — у владельца урока (учителя), а не у админа.
  let ownerUserId = auth.userId
  if (isAdmin) {
    const ownerRes = await admin.from('teacher_profiles').select('user_id').eq('id', lesson.teacher_id).maybeSingle()
    ownerUserId = (ownerRes.data as { user_id: string } | null)?.user_id ?? auth.userId
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
  const conn = await hasGoogleCalendar(ownerUserId)
  if (conn.connected) {
    const gBusy = await isSlotBusyInGoogle(ownerUserId, startISO, endISO)
    if (gBusy) {
      // Если у урока есть google_event_id, busy чаще всего — само событие урока
      // (isSlotBusyInGoogle его не исключает), поэтому не блокируем.
      if (!lesson.google_event_id) {
        return { ok: false, code: 'slot_busy_google', error: 'В это время в вашем Google Calendar уже есть событие' }
      }
    }
  }

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
      await updateEventInGoogle(ownerUserId, lesson.google_event_id, {
        startISO,
        endISO,
        sendUpdates: 'all',
      })
    } catch (e) {
      console.error('[rescheduleLesson] Google patch failed', e)
    }
  }
  // Личный календарь ученика: при бронировании туда пушится отдельное событие
  // (lessons.student_google_event_id) — переносим и его. Fail-soft.
  if (lesson.student_id && lesson.student_google_event_id) {
    try {
      const stuConn = await hasGoogleCalendar(lesson.student_id)
      if (stuConn.connected) {
        await updateEventInGoogle(lesson.student_id, lesson.student_google_event_id, { startISO, endISO })
      }
    } catch (e) {
      console.error('[rescheduleLesson] student Google patch failed', e)
    }
  }

  invalidateTeacherStudents(ownerUserId)
  invalidateTeacherDashboard(ownerUserId)
  if (lesson.student_id) invalidateStudentDashboard(lesson.student_id)

  // Уведомление другой стороне (обычно ученику). Fire-and-forget,
  // чтобы email/telegram не блокировали ответ UI. Пропускаем, если
  // время фактически не поменялось.
  if (lesson.scheduled_at !== startISO) {
    void notifyLessonRescheduled({
      lessonId: input.lessonId,
      oldScheduledAt: lesson.scheduled_at,
      changedByUserId: ownerUserId,
    }).catch(() => {})
  }

  return { ok: true }
}
