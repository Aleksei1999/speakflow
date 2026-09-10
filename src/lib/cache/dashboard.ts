// Кеш данных дашборда и list-страниц: `unstable_cache` по user.id с коротким
// TTL и per-user тегами; мутации дёргают revalidateTag.
//
// IMPORTANT: callbacks `unstable_cache` не должны трогать auth cookie context
// (cookies()/auth.getUser()). Внутри — service-role admin client, поэтому
// caller обязан аутентифицировать пользователя ДО вызова loader'ов.
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const profileTag = (userId: string) => `profile-${userId}`
export const progressTag = (userId: string) => `progress-${userId}`
export const teacherStatsTag = (userId: string) => `teacher-stats-${userId}`
export const studentMaterialsTag = (userId: string) =>
  `materials-${userId}`
export const studentHomeworkTag = (userId: string) =>
  `homework-${userId}`
export const teacherStudentsTag = (teacherUserId: string) =>
  `teacher-students-${teacherUserId}`
export const teacherHomeworkTag = (teacherUserId: string) =>
  `teacher-homework-${teacherUserId}`
export const teacherMaterialsTag = (teacherUserId: string) =>
  `teacher-materials-${teacherUserId}`
export const adminTrialRequestsTag = () => `admin-trial-requests`
export const adminStudentsTag = () => `admin-students`
export const adminTeachersListTag = () => `admin-teachers-list`

export type CachedProfile = {
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin' | null
  email_verified: boolean | null
  language: 'ru' | 'en' | null
} | null
async function loadProfile(userId: string): Promise<CachedProfile> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('profiles')
    .select('full_name, avatar_url, role, email_verified, language')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('[cache/profile] select failed', error)
    return null
  }
  return (data as CachedProfile) ?? null
}
// userId входит и в keyParts, чтобы у разных пользователей были разные записи.
export function getCachedProfile(userId: string): Promise<CachedProfile> {
  return unstable_cache(
    async (uid: string) => loadProfile(uid),
    ['dashboard-profile', userId],
    { tags: [profileTag(userId)], revalidate: 60 }
  )(userId)
}
// Reproduces the visibility logic that RLS would apply for a
// student: material is visible if
//   public=true
//   OR student is a participant in materials.lesson_id (lessons)
//   OR there's a material_shares row with target=student
//   OR there's a material_shares row with target=homework belonging to student
//   OR there's a material_shares row with target=group containing student
const MATERIALS_SELECT =
  'id, teacher_id, title, description, file_type, mime_type, file_size, ' +
  'level, tags, use_count, storage_path, file_url, lesson_id, is_public, created_at, folder_id'

export type CachedStudentMaterialsSnapshot = {
  rows: any[]
}

async function loadStudentMaterials(
  userId: string
): Promise<CachedStudentMaterialsSnapshot> {
  const admin = createAdminClient()

  const publicQ = (admin as any)
    .from('materials')
    .select(MATERIALS_SELECT)
    .eq('is_public', true)

  const studentLessonsQ = (admin as any)
    .from('lessons')
    .select('id')
    .eq('student_id', userId)

  const directSharesQ = (admin as any)
    .from('material_shares')
    .select('material_id')
    .eq('target_type', 'student')
    .eq('target_id', userId)

  const studentHwQ = (admin as any)
    .from('homework')
    .select('id')
    .eq('student_id', userId)

  const groupMembershipQ = (admin as any)
    .from('teacher_group_members')
    .select('group_id')
    .eq('student_id', userId)

  const [publicRes, lessonsRes, sharesDirectRes, hwRes, groupsRes] =
    await Promise.all([publicQ, studentLessonsQ, directSharesQ, studentHwQ, groupMembershipQ])

  if (publicRes.error) {
    console.error('[cache/student-materials] public select failed', publicRes.error)
  }

  const materialIds = new Set<string>()
  const rowsById = new Map<string, any>()
  for (const r of publicRes.data ?? []) {
    materialIds.add(r.id)
    rowsById.set(r.id, r)
  }

  const lessonIds = (lessonsRes.data ?? []).map((l: any) => l.id)
  if (lessonIds.length > 0) {
    const { data: lessonMats, error: lmErr } = await (admin as any)
      .from('materials')
      .select(MATERIALS_SELECT)
      .in('lesson_id', lessonIds)
    if (lmErr) {
      console.error('[cache/student-materials] lessons select failed', lmErr)
    }
    for (const r of lessonMats ?? []) {
      if (!rowsById.has(r.id)) rowsById.set(r.id, r)
      materialIds.add(r.id)
    }
  }

  const sharedIds = new Set<string>()
  for (const r of sharesDirectRes.data ?? []) sharedIds.add(r.material_id)

  const hwIds = (hwRes.data ?? []).map((h: any) => h.id)
  if (hwIds.length > 0) {
    const { data: hwShares } = await (admin as any)
      .from('material_shares')
      .select('material_id')
      .eq('target_type', 'homework')
      .in('target_id', hwIds)
    for (const r of hwShares ?? []) sharedIds.add(r.material_id)
  }

  const groupIds = (groupsRes.data ?? []).map((g: any) => g.group_id)
  if (groupIds.length > 0) {
    const { data: gShares } = await (admin as any)
      .from('material_shares')
      .select('material_id')
      .eq('target_type', 'group')
      .in('target_id', groupIds)
    for (const r of gShares ?? []) sharedIds.add(r.material_id)
  }

  const missing = Array.from(sharedIds).filter((id) => !rowsById.has(id))
  if (missing.length > 0) {
    const { data: sharedMats } = await (admin as any)
      .from('materials')
      .select(MATERIALS_SELECT)
      .in('id', missing)
    for (const r of sharedMats ?? []) {
      rowsById.set(r.id, r)
      materialIds.add(r.id)
    }
  }

  const rows = Array.from(rowsById.values()).sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return { rows }
}

export function getCachedStudentMaterials(
  userId: string
): Promise<CachedStudentMaterialsSnapshot> {
  return unstable_cache(
    async (uid: string) => loadStudentMaterials(uid),
    ['student-materials', userId],
    { tags: [studentMaterialsTag(userId)], revalidate: 60 }
  )(userId)
}

export type CachedTeacherStudentsSnapshot = {
  teacher_profile_id: string | null
  lessons: Array<{
    id: string
    student_id: string | null
    scheduled_at: string
    status: string
    duration_minutes: number
    teacher_notes: string | null
  }>
  profiles: Array<{
    id: string
    full_name: string | null
    avatar_url: string | null
    email: string | null
    role: string | null
  }>
  progress: Array<{
    user_id: string
    english_level: string | null
    total_xp: number
    current_streak: number
    lessons_completed: number
  }>
}

async function loadTeacherStudents(
  teacherUserId: string
): Promise<CachedTeacherStudentsSnapshot> {
  const admin = createAdminClient()

  const { data: tp, error: tpErr } = await (admin as any)
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', teacherUserId)
    .maybeSingle()
  if (tpErr) {
    console.error('[cache/teacher-students] tp select failed', tpErr)
    return {
      teacher_profile_id: null,
      lessons: [],
      profiles: [],
      progress: [],
    }
  }
  const teacherProfileId = tp?.id ?? null
  if (!teacherProfileId) {
    return {
      teacher_profile_id: null,
      lessons: [],
      profiles: [],
      progress: [],
    }
  }

  const { data: lessonRows, error: lErr } = await (admin as any)
    .from('lessons')
    .select(
      'id, student_id, scheduled_at, status, duration_minutes, teacher_notes'
    )
    .eq('teacher_id', teacherProfileId)
    .order('scheduled_at', { ascending: false })
  if (lErr) {
    console.error('[cache/teacher-students] lessons select failed', lErr)
  }

  const lessons = (lessonRows ?? []) as CachedTeacherStudentsSnapshot['lessons']
  const lessonStudentIds = lessons.map((l) => l.student_id).filter((x): x is string => !!x)

  // Учеников, «взятых» через trial-request accept (assigned_teacher_id = я),
  // тоже включаем в список — даже если у них ещё нет lessons-строки.
  const { data: trialRows } = await (admin as any)
    .from('trial_lesson_requests')
    .select('user_id')
    .eq('assigned_teacher_id', teacherProfileId)
    .in('status', ['assigned', 'scheduled'])
  const trialStudentIds = ((trialRows ?? []) as Array<{ user_id: string }>)
    .map((r) => r.user_id)
    .filter(Boolean)

  const studentIds = Array.from(new Set([...lessonStudentIds, ...trialStudentIds]))

  if (studentIds.length === 0) {
    return {
      teacher_profile_id: teacherProfileId,
      lessons,
      profiles: [],
      progress: [],
    }
  }

  const [profRes, progRes] = await Promise.all([
    (admin as any)
      .from('profiles')
      .select('id, full_name, avatar_url, email, role')
      .in('id', studentIds)
      .eq('role', 'student'),
    (admin as any)
      .from('user_progress')
      .select(
        'user_id, english_level, total_xp, current_streak, lessons_completed'
      )
      .in('user_id', studentIds),
  ])

  return {
    teacher_profile_id: teacherProfileId,
    lessons,
    profiles: profRes.data ?? [],
    progress: progRes.data ?? [],
  }
}

export function getCachedTeacherStudents(
  teacherUserId: string
): Promise<CachedTeacherStudentsSnapshot> {
  return unstable_cache(
    async (uid: string) => loadTeacherStudents(uid),
    ['teacher-students', teacherUserId],
    { tags: [teacherStudentsTag(teacherUserId)], revalidate: 60 }
  )(teacherUserId)
}
