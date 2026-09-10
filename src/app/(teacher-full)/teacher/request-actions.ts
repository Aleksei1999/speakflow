"use server"

// Server actions для «запросов на урок»: очередь входящих реквестов от
// студентов, которую учитель принимает (через createLesson) или отклоняет.

import { createAdminClient } from '@/lib/supabase/admin'
import { requireTeacher } from '@/lib/teacher/require'
import {
  invalidateTeacherDashboard,
  invalidateTeacherStudents,
} from '@/lib/cache/invalidate'
import { createLesson, type CreateLessonResult } from './lesson-actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

export interface LessonRequestRow {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  requestedAt: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  message: string | null
  createdAt: string
}

/** Pending-запросы текущего учителя, requested_at ASC — ближайшие сверху. */
export async function fetchLessonRequests(): Promise<LessonRequestRow[]> {
  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch {
    // Fail-soft, чтобы дашборд не свалился.
    return []
  }

  const admin = createAdminClient() as UntypedSupabase

  // teacher_profiles.id — это teacher_id в lesson_requests.
  const tpRes = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error || !tpRes.data) return []
  const teacherPk = (tpRes.data as { id: string }).id

  const rowsRes = await admin
    .from('lesson_requests')
    .select('id, student_id, requested_at, status, message, created_at')
    .eq('teacher_id', teacherPk)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(100)
  if (rowsRes.error || !rowsRes.data) return []
  const rows = rowsRes.data as Array<{
    id: string
    student_id: string
    requested_at: string
    status: LessonRequestRow['status']
    message: string | null
    created_at: string
  }>
  if (rows.length === 0) return []

  // Один join-in-app вместо N+1: тянем всех уникальных students разом.
  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)))
  const profRes = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', studentIds)
  const profMap = new Map<string, { name: string; avatar: string | null }>()
  if (!profRes.error && profRes.data) {
    for (const p of profRes.data as Array<{
      id: string
      full_name: string | null
      avatar_url: string | null
    }>) {
      profMap.set(p.id, {
        name: p.full_name || 'Ученик',
        avatar: p.avatar_url,
      })
    }
  }

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: profMap.get(r.student_id)?.name ?? 'Ученик',
    studentAvatar: profMap.get(r.student_id)?.avatar ?? null,
    requestedAt: r.requested_at,
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
  }))
}

export interface AcceptLessonRequestInput {
  requestId: string
  /** Опционально: если учитель хочет назначить урок на другое время.
   *  По умолчанию используем requested_at из запроса. */
  scheduledAt?: string
}

export type AcceptLessonRequestResult =
  | { ok: true; lessonId: string }
  | { ok: false; error: string; code?: string }

export async function acceptLessonRequest(
  input: AcceptLessonRequestInput,
): Promise<AcceptLessonRequestResult> {
  if (!input?.requestId || typeof input.requestId !== 'string') {
    return { ok: false, error: 'requestId is required', code: 'validation' }
  }

  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Unauthorized',
      code: 'auth',
    }
  }

  const admin = createAdminClient() as UntypedSupabase

  const tpRes = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error || !tpRes.data) {
    return { ok: false, error: 'teacher_profiles not found', code: 'db' }
  }
  const teacherPk = (tpRes.data as { id: string }).id

  const reqRes = await admin
    .from('lesson_requests')
    .select('id, student_id, teacher_id, requested_at, status')
    .eq('id', input.requestId)
    .maybeSingle()
  if (reqRes.error) {
    return { ok: false, error: `load request: ${reqRes.error.message}`, code: 'db' }
  }
  const req = reqRes.data as {
    id: string
    student_id: string
    teacher_id: string
    requested_at: string
    status: LessonRequestRow['status']
  } | null
  if (!req) return { ok: false, error: 'Запрос не найден', code: 'validation' }
  if (req.teacher_id !== teacherPk) {
    return { ok: false, error: 'Forbidden: not request owner', code: 'auth' }
  }
  if (req.status !== 'pending') {
    return { ok: false, error: 'Запрос уже обработан', code: 'validation' }
  }

  const scheduledAt = input.scheduledAt || req.requested_at

  // createLesson сам проверит слот (lessons + Google) и зеркалит в Google.
  const created: CreateLessonResult = await createLesson({
    studentId: req.student_id,
    scheduledAt,
  })
  if (!created.ok) {
    // Слот занят — request остаётся pending, учитель выберет другое время.
    return { ok: false, error: created.error, code: created.code }
  }

  // Fail-soft: lesson уже создан, при ошибке запрос останется pending.
  const updRes = await admin
    .from('lesson_requests')
    .update({ status: 'accepted' })
    .eq('id', input.requestId)
  if (updRes.error) {
    console.error('[acceptLessonRequest] mark accepted failed', updRes.error)
  }

  invalidateTeacherDashboard(auth.userId)
  invalidateTeacherStudents(auth.userId)

  return { ok: true, lessonId: created.lessonId }
}

export interface RejectLessonRequestInput {
  requestId: string
}

export type RejectLessonRequestResult =
  | { ok: true }
  | { ok: false; error: string }

export async function rejectLessonRequest(
  { requestId }: RejectLessonRequestInput,
): Promise<RejectLessonRequestResult> {
  if (!requestId || typeof requestId !== 'string') {
    return { ok: false, error: 'requestId is required' }
  }

  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unauthorized' }
  }

  const admin = createAdminClient() as UntypedSupabase

  const tpRes = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', auth.userId)
    .maybeSingle()
  if (tpRes.error || !tpRes.data) {
    return { ok: false, error: 'teacher_profiles not found' }
  }
  const teacherPk = (tpRes.data as { id: string }).id

  const reqRes = await admin
    .from('lesson_requests')
    .select('id, teacher_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (reqRes.error) {
    return { ok: false, error: `load request: ${reqRes.error.message}` }
  }
  const req = reqRes.data as {
    id: string
    teacher_id: string
    status: LessonRequestRow['status']
  } | null
  if (!req) return { ok: false, error: 'Запрос не найден' }
  if (req.teacher_id !== teacherPk) {
    return { ok: false, error: 'Forbidden: not request owner' }
  }
  if (req.status !== 'pending') {
    return { ok: false, error: 'Запрос уже обработан' }
  }

  const updRes = await admin
    .from('lesson_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
  if (updRes.error) {
    return { ok: false, error: `update: ${updRes.error.message}` }
  }

  invalidateTeacherDashboard(auth.userId)

  return { ok: true }
}
