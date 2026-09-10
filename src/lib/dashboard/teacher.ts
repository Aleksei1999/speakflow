// Снапшот teacher-дашборда одним RPC `public.get_teacher_dashboard` +
// per-user `unstable_cache` с тегом `teacher-dashboard-<uid>`.
//
// IMPORTANT: callback `unstable_cache` не трогает cookie context — внутри
// service-role admin client, поэтому caller обязан аутентифицировать
// пользователя ДО вызова. SQL-guard в функции — страховка, не единственный гейт.
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const teacherDashboardTag = (userId: string) =>
  `teacher-dashboard-${userId}`

// Shape повторяет ответ get_teacher_dashboard; типизируем только ключи,
// нужные странице.
export type TeacherDashboardProfile = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin' | null
  email: string | null
  created_at: string
} | null

export type TeacherDashboardTeacherProfile = {
  id: string
  user_id: string
  bio: string | null
  specializations: string[] | null
  hourly_rate: number | null
  trial_rate: number | null
  video_intro_url: string | null
  rating: number | null
  total_reviews: number | null
  experience_years: number | null
  languages: string[] | null
  certificates: string[] | null
  is_verified: boolean | null
  is_listed: boolean | null
  total_lessons: number | null
} | null

export type TeacherDashboardLesson = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  price: number | null
  student_id: string
  student_name: string | null
  student_avatar: string | null
  is_trial: boolean
}

export type TeacherDashboardClub = {
  id: string
  topic: string | null
  starts_at: string
  duration_min: number | null
  is_published: boolean
  cancelled_at: string | null
  seats_taken: number | null
  capacity: number | null
  max_seats: number | null
}

export type TeacherDashboardWeekStats = {
  total: number
  completed: number
  cancelled: number
}

export type TeacherDashboardMonthStats = {
  this_month_count: number
  prev_month_count: number
  earnings_kopecks: number
}

export type TeacherDashboard = {
  profile: TeacherDashboardProfile
  teacher_profile: TeacherDashboardTeacherProfile
  teacher_profile_id: string | null
  today: TeacherDashboardLesson[]
  upcoming: TeacherDashboardLesson[]
  today_clubs: TeacherDashboardClub[]
  week_stats: TeacherDashboardWeekStats
  month_stats: TeacherDashboardMonthStats
  active_lesson: {
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    student_id: string
  } | null
  club_hosts_unread: number
  pending_trial_count: number
  generated_at: string
}

async function loadTeacherDashboard(userId: string): Promise<TeacherDashboard | null> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('get_teacher_dashboard', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[dashboard/teacher] rpc failed', error)
    return null
  }
  if (!data) return null
  return normaliseTeacherDashboard(data)
}

// Defensive shape-coercion: SQL returns COALESCE'd arrays but the
// `active_lesson` slot can legitimately be null. We also fill numeric
// counters with 0 so the page doesn't need `?? 0` everywhere.
function normaliseTeacherDashboard(raw: any): TeacherDashboard {
  return {
    profile: raw.profile ?? null,
    teacher_profile: raw.teacher_profile ?? null,
    teacher_profile_id: raw.teacher_profile_id ?? null,
    today: Array.isArray(raw.today) ? raw.today : [],
    upcoming: Array.isArray(raw.upcoming) ? raw.upcoming : [],
    today_clubs: Array.isArray(raw.today_clubs) ? raw.today_clubs : [],
    week_stats: {
      total: Number(raw.week_stats?.total ?? 0),
      completed: Number(raw.week_stats?.completed ?? 0),
      cancelled: Number(raw.week_stats?.cancelled ?? 0),
    },
    month_stats: {
      this_month_count: Number(raw.month_stats?.this_month_count ?? 0),
      prev_month_count: Number(raw.month_stats?.prev_month_count ?? 0),
      earnings_kopecks: Number(raw.month_stats?.earnings_kopecks ?? 0),
    },
    active_lesson: raw.active_lesson ?? null,
    club_hosts_unread: Number(raw.club_hosts_unread ?? 0),
    pending_trial_count: Number(raw.pending_trial_count ?? 0),
    generated_at: raw.generated_at ?? new Date().toISOString(),
  }
}

export function getCachedTeacherDashboard(
  userId: string,
): Promise<TeacherDashboard | null> {
  return unstable_cache(
    async (uid: string) => loadTeacherDashboard(uid),
    ['teacher-dashboard', userId],
    { tags: [teacherDashboardTag(userId)], revalidate: 120 },
  )(userId)
}
