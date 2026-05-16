// ============================================================
// Dashboard layout + list-page cache
// ------------------------------------------------------------
// (dashboard)/layout.tsx is force-dynamic and runs on every
// internal navigation under /student, /teacher, /admin. Each
// render fires three Supabase round-trips (profile, progress,
// teacher_profile) — historically +50–100 ms per click.
//
// We wrap those reads in `unstable_cache` keyed by user.id with
// short TTLs and per-user tags, then `revalidateTag` from the
// few mutation sites (settings save, teacher approval, lesson
// completion, XP events, review insert). User can never see
// stale data longer than the TTL even if a revalidate call is
// missed somewhere — that's the safety floor.
//
// The same paradigm extends to list-page data loaders below
// (homework, teacher students, clubs, admin students/trial
// requests/etc). Their cache keys are the relevant user.id
// (or a global key for admin-wide lists), with per-tag
// invalidation hooks in mutation endpoints.
//
// IMPORTANT: `unstable_cache` callbacks must NOT touch the auth
// cookie context (cookies()/auth.getUser()). We use the service
// role admin client inside, and the userId argument is the
// only cache key — RLS bypass is fine because the caller has
// already authenticated upstream (the page does cookies()
// + redirect("/login") BEFORE calling these loaders).
// ============================================================
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// --- Tag helpers --------------------------------------------
export const profileTag = (userId: string) => `profile-${userId}`
export const progressTag = (userId: string) => `progress-${userId}`
export const teacherStatsTag = (userId: string) => `teacher-stats-${userId}`
export const studentMaterialsTag = (userId: string) =>
  `materials-${userId}`
export const studentHomeworkTag = (userId: string) =>
  `homework-${userId}`
export const teacherStudentsTag = (teacherUserId: string) =>
  `teacher-students-${teacherUserId}`
export const teacherClubsTag = (teacherUserId: string) =>
  `teacher-clubs-${teacherUserId}`
export const teacherHomeworkTag = (teacherUserId: string) =>
  `teacher-homework-${teacherUserId}`
export const teacherMaterialsTag = (teacherUserId: string) =>
  `teacher-materials-${teacherUserId}`
export const adminTrialRequestsTag = () => `admin-trial-requests`
export const adminStudentsTag = () => `admin-students`
export const adminClubsTag = () => `admin-clubs`
export const adminSupportTag = () => `admin-support`
export const adminTeachersListTag = () => `admin-teachers-list`

// --- Types --------------------------------------------------
export type CachedProfile = {
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin' | null
  email_verified: boolean | null
  language: 'ru' | 'en' | null
} | null

export type CachedUserProgress = {
  total_xp: number | null
  english_level: string | null
  current_streak: number | null
} | null

export type CachedTeacherStats = {
  rating: number | null
  total_reviews: number | null
  experience_years: number | null
} | null

// --- Loaders (uncached) -------------------------------------
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

async function loadUserProgress(userId: string): Promise<CachedUserProgress> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('user_progress')
    .select('total_xp, english_level, current_streak')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[cache/progress] select failed', error)
    return null
  }
  return (data as CachedUserProgress) ?? null
}

async function loadTeacherStats(userId: string): Promise<CachedTeacherStats> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('teacher_profiles')
    .select('rating, total_reviews, experience_years')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[cache/teacher-stats] select failed', error)
    return null
  }
  return (data as CachedTeacherStats) ?? null
}

// --- Cached wrappers ----------------------------------------
// `unstable_cache` requires the cache key to include all
// inputs the callback closes over. We pass userId both as the
// callback arg AND as part of the keyParts array so distinct
// users get distinct cache entries.

export function getCachedProfile(userId: string): Promise<CachedProfile> {
  return unstable_cache(
    async (uid: string) => loadProfile(uid),
    ['dashboard-profile', userId],
    { tags: [profileTag(userId)], revalidate: 60 }
  )(userId)
}

export function getCachedUserProgress(userId: string): Promise<CachedUserProgress> {
  return unstable_cache(
    async (uid: string) => loadUserProgress(uid),
    ['dashboard-progress', userId],
    { tags: [progressTag(userId)], revalidate: 120 }
  )(userId)
}

export function getCachedTeacherStats(userId: string): Promise<CachedTeacherStats> {
  return unstable_cache(
    async (uid: string) => loadTeacherStats(uid),
    ['dashboard-teacher-stats', userId],
    { tags: [teacherStatsTag(userId)], revalidate: 60 }
  )(userId)
}

// ============================================================
// LIST-PAGE LOADERS
// ------------------------------------------------------------
// Each loader returns the FULL data set the page needs, then
// the page (still per-request, behind cookies()) decides
// which slice / filter / sort to show. This keeps cache keys
// simple (userId only, no per-filter combinatorial blowup).
// ============================================================

// --- Student homework ---------------------------------------
const HOMEWORK_SELECT =
  'id, student_id, teacher_id, lesson_id, title, description, due_date, ' +
  'status, submission_text, teacher_feedback, grade, score_10, ' +
  'submitted_at, reviewed_at, attachments, created_at, updated_at'

export type CachedStudentHomeworkSnapshot = {
  // Raw rows ordered by created_at desc; no UI-status / sorting applied —
  // page derives those because they depend on Date.now() and are cheap.
  rows: any[]
  teachers: Record<string, { id: string; full_name: string | null; avatar_url: string | null }>
  lessons: Record<string, { id: string; scheduled_at: string }>
  xp_this_month: number
}

async function loadStudentHomework(
  userId: string
): Promise<CachedStudentHomeworkSnapshot> {
  const admin = createAdminClient()

  const { data: rows, error } = await (admin as any)
    .from('homework')
    .select(HOMEWORK_SELECT)
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    console.error('[cache/student-homework] select failed', error)
    return { rows: [], teachers: {}, lessons: {}, xp_this_month: 0 }
  }

  const allRows: any[] = rows ?? []
  const teacherIds = Array.from(
    new Set(allRows.map((r) => r.teacher_id).filter(Boolean))
  )
  const lessonIds = Array.from(
    new Set(allRows.map((r) => r.lesson_id).filter(Boolean))
  )

  const [teachersRes, lessonsRes] = await Promise.all([
    teacherIds.length > 0
      ? (admin as any)
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', teacherIds)
      : Promise.resolve({ data: [] as any[] }),
    lessonIds.length > 0
      ? (admin as any)
          .from('lessons')
          .select('id, scheduled_at')
          .in('id', lessonIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const teachers: Record<string, any> = {}
  for (const t of teachersRes.data ?? []) teachers[t.id] = t
  const lessons: Record<string, any> = {}
  for (const l of lessonsRes.data ?? []) lessons[l.id] = l

  // XP this month — pre-aggregated server-side so the page just reads it.
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { data: xpRows } = await (admin as any)
    .from('xp_events')
    .select('amount')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
  let xpThisMonth = 0
  for (const x of xpRows ?? []) xpThisMonth += Number(x.amount) || 0

  return {
    rows: allRows,
    teachers,
    lessons,
    xp_this_month: xpThisMonth,
  }
}

export function getCachedStudentHomework(
  userId: string
): Promise<CachedStudentHomeworkSnapshot> {
  return unstable_cache(
    async (uid: string) => loadStudentHomework(uid),
    ['student-homework', userId],
    { tags: [studentHomeworkTag(userId)], revalidate: 60 }
  )(userId)
}

// --- Student materials --------------------------------------
// Reproduces the visibility logic that RLS would apply for a
// student: material is visible if
//   public=true
//   OR student is a participant in materials.lesson_id (lessons)
//   OR there's a material_shares row with target=student
//   OR there's a material_shares row with target=homework belonging to student
//   OR there's a material_shares row with target=group containing student
const MATERIALS_SELECT =
  'id, teacher_id, title, description, file_type, mime_type, file_size, ' +
  'level, tags, use_count, storage_path, file_url, lesson_id, is_public, created_at'

export type CachedStudentMaterialsSnapshot = {
  rows: any[]
}

async function loadStudentMaterials(
  userId: string
): Promise<CachedStudentMaterialsSnapshot> {
  const admin = createAdminClient()

  // 1) Public materials.
  const publicQ = (admin as any)
    .from('materials')
    .select(MATERIALS_SELECT)
    .eq('is_public', true)

  // 2) Materials attached to lessons the student participated in.
  const studentLessonsQ = (admin as any)
    .from('lessons')
    .select('id')
    .eq('student_id', userId)

  // 3) Material shares targeting this student directly.
  const directSharesQ = (admin as any)
    .from('material_shares')
    .select('material_id')
    .eq('target_type', 'student')
    .eq('target_id', userId)

  // 4) Material shares via this student's homework.
  const studentHwQ = (admin as any)
    .from('homework')
    .select('id')
    .eq('student_id', userId)

  // 5) Material shares via groups containing this student.
  // teacher_group_members.member_id -> group_id
  const groupMembershipQ = (admin as any)
    .from('teacher_group_members')
    .select('group_id')
    .eq('member_id', userId)

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

  // Fetch materials linked to the student's lessons.
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

  // Collect material_ids from share branches.
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

  // Resolve shared material rows we don't have yet.
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

// --- Teacher students (distinct via lessons) ----------------
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
  const studentIds = Array.from(
    new Set(lessons.map((l) => l.student_id).filter((x): x is string => !!x))
  )

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

// --- Teacher clubs ------------------------------------------
export type CachedTeacherClubsSnapshot = {
  clubs: any[]
  unread_count: number
}

async function loadTeacherClubs(
  teacherUserId: string
): Promise<CachedTeacherClubsSnapshot> {
  const admin = createAdminClient()

  const { data: hostRows, error: hostErr } = await (admin as any)
    .from('club_hosts')
    .select('club_id, role, sort_order, seen_at')
    .eq('host_id', teacherUserId)
  if (hostErr) {
    console.error('[cache/teacher-clubs] club_hosts select failed', hostErr)
    return { clubs: [], unread_count: 0 }
  }

  const ids = (hostRows ?? []).map((r: any) => r.club_id)
  if (ids.length === 0) {
    return { clubs: [], unread_count: 0 }
  }

  const { data: clubs, error: clubsErr } = await (admin as any)
    .from('clubs')
    .select(
      `
        id, topic, description, category, format, location, timezone,
        starts_at, duration_min, max_seats, seats_taken, capacity,
        price_kopecks, xp_reward, badge, cover_emoji,
        is_published, cancelled_at, level_min, level_max,
        created_at, updated_at,
        club_hosts (
          role, sort_order, seen_at,
          host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
        )
      `
    )
    .in('id', ids)
    .order('starts_at', { ascending: true })
  if (clubsErr) {
    console.error('[cache/teacher-clubs] clubs select failed', clubsErr)
    return { clubs: [], unread_count: 0 }
  }

  // Participants per club.
  const { data: regs } = await (admin as any)
    .from('club_registrations')
    .select(
      'club_id, status, registered_at, user:profiles!club_registrations_user_id_fkey(id, full_name, avatar_url, email)'
    )
    .in('club_id', ids)
    .in('status', ['registered', 'pending_payment', 'attended', 'waitlist'])
    .order('registered_at', { ascending: true })

  const partsByClub = new Map<string, any[]>()
  for (const r of regs ?? []) {
    const arr = partsByClub.get(r.club_id) ?? []
    arr.push({
      id: r.user?.id ?? null,
      full_name: r.user?.full_name ?? null,
      avatar_url: r.user?.avatar_url ?? null,
      email: r.user?.email ?? null,
      status: r.status,
      registered_at: r.registered_at,
    })
    partsByClub.set(r.club_id, arr)
  }

  const seenById = new Map<string, string | null>()
  for (const r of hostRows ?? []) {
    if (r.club_id) seenById.set(r.club_id, r.seen_at ?? null)
  }

  const enriched = (clubs ?? []).map((c: any) => {
    const cancelled = !!c.cancelled_at
    const status = cancelled
      ? 'cancelled'
      : c.is_published
      ? 'published'
      : 'draft'
    const capacity = c.capacity ?? c.max_seats ?? 0
    const seatsTaken = c.seats_taken ?? 0
    return {
      id: c.id,
      title: c.topic ?? '',
      description: c.description ?? null,
      scheduled_at: c.starts_at ?? null,
      duration_minutes: c.duration_min ?? 60,
      level: c.level_min ?? null,
      category: c.category ?? null,
      format: c.format ?? null,
      location: c.location ?? null,
      cover_emoji: c.cover_emoji ?? null,
      capacity,
      registered_count: seatsTaken,
      seats_remaining: Math.max(capacity - seatsTaken, 0),
      is_full: seatsTaken >= capacity,
      status,
      seen_at: seenById.get(c.id) ?? null,
      is_unseen: !seenById.get(c.id),
      participants: partsByClub.get(c.id) ?? [],
    }
  })

  const unread_count = enriched.filter((c: any) => c.is_unseen).length
  return { clubs: enriched, unread_count }
}

export function getCachedTeacherClubs(
  teacherUserId: string
): Promise<CachedTeacherClubsSnapshot> {
  return unstable_cache(
    async (uid: string) => loadTeacherClubs(uid),
    ['teacher-clubs', teacherUserId],
    { tags: [teacherClubsTag(teacherUserId)], revalidate: 60 }
  )(teacherUserId)
}

// --- Admin: trial requests (teacher applications) ----------
export type CachedAdminTrialRequest = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  contact: string | null
  notes: string | null
  status: 'new' | 'in_review' | 'approved' | 'rejected' | 'archived'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

async function loadAdminTrialRequests(
  status?: string
): Promise<CachedAdminTrialRequest[]> {
  const admin = createAdminClient()
  let q = (admin as any)
    .from('teacher_applications')
    .select(
      'id, first_name, last_name, email, contact, notes, status, reviewed_by, reviewed_at, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)
  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    console.error('[cache/admin-trial-requests] select failed', error)
    return []
  }
  return (data ?? []) as CachedAdminTrialRequest[]
}

export function getCachedAdminTrialRequests(opts?: {
  status?: string
}): Promise<CachedAdminTrialRequest[]> {
  const status = opts?.status ?? 'all'
  return unstable_cache(
    async (s: string) => loadAdminTrialRequests(s === 'all' ? undefined : s),
    ['admin-trial-requests', status],
    { tags: [adminTrialRequestsTag()], revalidate: 120 }
  )(status)
}

// --- Admin: students -----------------------------------------
export type CachedAdminStudent = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  phone: string | null
  english_level: string | null
  english_goal: string | null
  city: string | null
  occupation: string | null
  created_at: string
  last_seen_at: string | null
  total_xp: number
  current_level: number
  lessons_count: number
  current_streak: number
  subscription_tier: string
  subscription_until: string | null
}

async function loadAdminStudents(opts: {
  limit: number
  sort: 'recent' | 'name'
}): Promise<CachedAdminStudent[]> {
  const admin = createAdminClient()
  let q = (admin as any)
    .from('profiles')
    .select(
      `
        id, full_name, first_name, last_name, email, avatar_url,
        phone, english_goal, city, occupation, created_at,
        subscription_tier, subscription_until,
        user_progress:user_progress!user_progress_user_id_fkey (
          total_xp, current_level, lessons_completed, current_streak,
          english_level, updated_at
        )
      `
    )
    .eq('role', 'student')
    .limit(opts.limit)
  if (opts.sort === 'name') {
    q = q.order('full_name', { ascending: true })
  } else {
    q = q.order('created_at', { ascending: false })
  }
  const { data, error } = await q
  if (error) {
    console.error('[cache/admin-students] select failed', error)
    return []
  }
  return ((data ?? []) as any[]).map((s: any) => {
    const up = Array.isArray(s.user_progress) ? s.user_progress[0] : s.user_progress
    return {
      id: s.id,
      full_name: s.full_name,
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
      avatar_url: s.avatar_url,
      phone: s.phone,
      english_level: up?.english_level ?? null,
      english_goal: s.english_goal,
      city: s.city,
      occupation: s.occupation,
      created_at: s.created_at,
      last_seen_at: up?.updated_at ?? null,
      total_xp: up?.total_xp ?? 0,
      current_level: up?.current_level ?? 1,
      lessons_count: up?.lessons_completed ?? 0,
      current_streak: up?.current_streak ?? 0,
      subscription_tier: s.subscription_tier ?? 'free',
      subscription_until: s.subscription_until ?? null,
    }
  })
}

export function getCachedAdminStudents(opts?: {
  limit?: number
  sort?: 'recent' | 'name'
}): Promise<CachedAdminStudent[]> {
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
  const sort: 'recent' | 'name' = opts?.sort === 'name' ? 'name' : 'recent'
  return unstable_cache(
    async (lim: string, srt: string) =>
      loadAdminStudents({ limit: Number(lim), sort: srt as 'recent' | 'name' }),
    ['admin-students', String(limit), sort],
    { tags: [adminStudentsTag()], revalidate: 60 }
  )(String(limit), sort)
}

// --- Admin: clubs --------------------------------------------
export type CachedAdminClubsSnapshot = {
  clubs: any[]
}

async function loadAdminClubs(opts: {
  status?: 'upcoming' | 'past' | 'draft' | 'all'
  limit: number
}): Promise<CachedAdminClubsSnapshot> {
  const admin = createAdminClient()
  let q = (admin as any)
    .from('clubs')
    .select(
      `
        id, topic, description, category, format, location, timezone,
        starts_at, duration_min, max_seats, seats_taken, capacity,
        price_kopecks, xp_reward, badge, cover_emoji,
        is_published, cancelled_at, assigned_by, created_by_role,
        level_min, level_max, created_at, updated_at,
        club_hosts (
          role, sort_order,
          host:profiles!club_hosts_host_id_fkey ( id, full_name, avatar_url )
        )
      `
    )
    .limit(opts.limit)
  const nowIso = new Date().toISOString()
  if (opts.status === 'upcoming') {
    q = q
      .gt('starts_at', nowIso)
      .is('cancelled_at', null)
      .order('starts_at', { ascending: true })
  } else if (opts.status === 'past') {
    q = q.lt('starts_at', nowIso).order('starts_at', { ascending: false })
  } else if (opts.status === 'draft') {
    q = q.eq('is_published', false).order('created_at', { ascending: false })
  } else {
    q = q.order('starts_at', { ascending: false })
  }

  const { data, error } = await q
  if (error) {
    console.error('[cache/admin-clubs] select failed', error)
    return { clubs: [] }
  }

  const clubIds = (data ?? []).map((c: any) => c.id)
  const partsByClub = new Map<string, any[]>()
  if (clubIds.length > 0) {
    const { data: regs } = await (admin as any)
      .from('club_registrations')
      .select(
        'club_id, status, registered_at, user:profiles!club_registrations_user_id_fkey(id, full_name, avatar_url, email)'
      )
      .in('club_id', clubIds)
      .in('status', ['registered', 'pending_payment', 'attended', 'waitlist'])
      .order('registered_at', { ascending: true })
    for (const r of regs ?? []) {
      const arr = partsByClub.get(r.club_id) ?? []
      arr.push({
        id: r.user?.id ?? null,
        full_name: r.user?.full_name ?? null,
        avatar_url: r.user?.avatar_url ?? null,
        email: r.user?.email ?? null,
        status: r.status,
        registered_at: r.registered_at,
      })
      partsByClub.set(r.club_id, arr)
    }
  }

  const enriched = (data ?? []).map((c: any) => {
    const cancelled = !!c.cancelled_at
    const status = cancelled
      ? 'cancelled'
      : c.is_published
      ? 'published'
      : 'draft'
    const host =
      Array.isArray(c.club_hosts) && c.club_hosts.length
        ? c.club_hosts[0]?.host
        : null
    const capacity = c.capacity ?? c.max_seats ?? 0
    const seatsTaken = c.seats_taken ?? 0
    return {
      ...c,
      title: c.topic ?? c.title ?? '',
      scheduled_at: c.starts_at ?? c.scheduled_at ?? null,
      duration_minutes: c.duration_min ?? c.duration_minutes ?? 60,
      level: c.level_min ?? c.level ?? null,
      status,
      capacity,
      registered_count: seatsTaken,
      seats_remaining: Math.max(capacity - seatsTaken, 0),
      is_full: seatsTaken >= capacity,
      host_teacher_id: host?.id ?? null,
      host_teacher_name: host?.full_name ?? null,
      participants: partsByClub.get(c.id) ?? [],
    }
  })

  return { clubs: enriched }
}

export function getCachedAdminClubs(opts?: {
  status?: 'upcoming' | 'past' | 'draft' | 'all'
  limit?: number
}): Promise<CachedAdminClubsSnapshot> {
  const status = opts?.status ?? 'all'
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50))
  return unstable_cache(
    async (s: string, lim: string) =>
      loadAdminClubs({
        status: s as 'upcoming' | 'past' | 'draft' | 'all',
        limit: Number(lim),
      }),
    ['admin-clubs', status, String(limit)],
    { tags: [adminClubsTag()], revalidate: 60 }
  )(status, String(limit))
}

// --- Admin: teachers list (lightweight dropdown source) ----
export type CachedAdminTeachersListItem = {
  id: string // user_id (auth.users.id)
  teacher_profile_id: string | null
  full_name: string | null
  avatar_url: string | null
  email: string | null
}

async function loadAdminTeachersList(
  limit: number
): Promise<CachedAdminTeachersListItem[]> {
  const admin = createAdminClient()
  // Take all teacher_profiles, then join their auth-side profile.
  const { data: tps, error } = await (admin as any)
    .from('teacher_profiles')
    .select('id, user_id, is_listed')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[cache/admin-teachers-list] tp select failed', error)
    return []
  }
  const userIds = (tps ?? []).map((t: any) => t.user_id).filter(Boolean)
  if (userIds.length === 0) return []
  const { data: profs } = await (admin as any)
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', userIds)
  const profMap: Record<string, any> = {}
  for (const p of profs ?? []) profMap[p.id] = p

  return (tps ?? []).map((t: any) => {
    const p = profMap[t.user_id] || {}
    return {
      id: t.user_id,
      teacher_profile_id: t.id,
      full_name: p.full_name ?? null,
      avatar_url: p.avatar_url ?? null,
      email: p.email ?? null,
    }
  })
}

export function getCachedAdminTeachersList(opts?: {
  limit?: number
}): Promise<CachedAdminTeachersListItem[]> {
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100))
  return unstable_cache(
    async (lim: string) => loadAdminTeachersList(Number(lim)),
    ['admin-teachers-list', String(limit)],
    { tags: [adminTeachersListTag()], revalidate: 120 }
  )(String(limit))
}

// --- Admin: support threads ---------------------------------
export type CachedAdminSupportThread = {
  id: string
  subject: string
  student_id: string | null
  student_name: string
  student_email: string | null
  student_level: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'pending' | 'resolved' | 'closed'
  last_message_at: string
  created_at: string
  unread_count: number
  last_message_preview: string | null
}

async function loadAdminSupportThreads(opts: {
  limit: number
}): Promise<CachedAdminSupportThread[]> {
  const admin = createAdminClient()
  // Schema mirrors GET /api/support/threads?admin=1 exactly so the
  // page sees an identical payload regardless of cache hit/miss.
  const { data, error } = await (admin as any)
    .from('support_threads')
    .select(
      `
        id, user_id, subject, status, priority,
        last_message_at, last_user_message_at, admin_last_seen_at,
        created_at, updated_at,
        profiles:user_id ( id, full_name, avatar_url, email, role )
      `
    )
    .order('last_message_at', { ascending: false })
    .limit(opts.limit)
  if (error) {
    console.error('[cache/admin-support] select failed', error)
    return []
  }

  const threadIds = (data ?? []).map((t: any) => t.id)
  const previewByThread = new Map<string, { body: string }>()
  if (threadIds.length) {
    const { data: msgs } = await (admin as any)
      .from('support_messages')
      .select('thread_id, body, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
    for (const m of msgs ?? []) {
      if (!previewByThread.has(m.thread_id)) {
        previewByThread.set(m.thread_id, { body: m.body })
      }
    }
  }

  const mapPriority = (p: string): 'low' | 'medium' | 'high' =>
    p === 'med' ? 'medium' : (p as 'low' | 'medium' | 'high')

  return ((data ?? []) as any[]).map((t: any) => {
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
    const lastUserAt = t.last_user_message_at
      ? new Date(t.last_user_message_at).getTime()
      : null
    const adminSeenAt = t.admin_last_seen_at
      ? new Date(t.admin_last_seen_at).getTime()
      : null
    const unreadForAdmin =
      lastUserAt !== null && (adminSeenAt === null || adminSeenAt < lastUserAt)
    const preview = previewByThread.get(t.id)
    return {
      id: t.id,
      subject: t.subject ?? '',
      student_id: profile?.id ?? null,
      student_name: profile?.full_name || profile?.email || '—',
      student_email: profile?.email ?? null,
      student_level: null,
      priority: mapPriority(t.priority),
      status:
        (t.status as 'open' | 'pending' | 'resolved' | 'closed') ?? 'open',
      last_message_at: t.last_message_at ?? t.created_at,
      created_at: t.created_at,
      unread_count: unreadForAdmin ? 1 : 0,
      last_message_preview: preview?.body
        ? preview.body.slice(0, 140)
        : null,
    }
  })
}

export function getCachedAdminSupportThreads(opts?: {
  limit?: number
}): Promise<CachedAdminSupportThread[]> {
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 100))
  return unstable_cache(
    async (lim: string) => loadAdminSupportThreads({ limit: Number(lim) }),
    ['admin-support', String(limit)],
    { tags: [adminSupportTag()], revalidate: 120 }
  )(String(limit))
}
