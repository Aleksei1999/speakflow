// ============================================================
// /teacher dashboard — single-RPC snapshot loader
// ------------------------------------------------------------
// Before this helper, src/app/(dashboard)/teacher/page.tsx fired
// 10+ separate Supabase queries (profile, teacher_profile, today,
// upcoming, hosted-clubs, month/prev-month counts, completed-month
// earnings, week stats, active lessons, trial-id map, ...). On a
// cold start under revalidate=30 this added 600–900 ms of serial
// network latency before the page could even start rendering.
//
// public.get_teacher_dashboard(p_user_id) returns the entire
// payload in one round-trip as jsonb. We wrap it in
// `unstable_cache` keyed by user id with a 30s TTL and a
// per-user tag (`teacher-dashboard-${userId}`) so mutation
// endpoints can invalidate it explicitly.
//
// IMPORTANT: the `unstable_cache` callback must NOT touch the
// request cookie context. We use the service-role admin client
// inside — the page has already verified the cookies-based auth
// upstream (cookies() + redirect("/login")) BEFORE calling us.
// Inside the SQL function `SECURITY DEFINER` enforces that
// `auth.uid() = p_user_id` (or admin), so even if a caller smuggles
// a foreign uid we'd 42501-fail at the DB. But we pass the
// service-role bypass at the network level — the SQL guard is
// the safety net, not the only gate.
// ============================================================
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// --- Tag helper ----------------------------------------------
export const teacherDashboardTag = (userId: string) =>
  `teacher-dashboard-${userId}`

// --- Types ---------------------------------------------------
// Shape mirrors what get_teacher_dashboard returns. We type only
// the keys consumed by the page; unknown fields stay as `any`
// to avoid noisy SQL/TS drift when the RPC grows.

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

// --- Loader (uncached) ---------------------------------------
async function loadTeacherDashboard(userId: string): Promise<TeacherDashboard | null> {
  const admin = createAdminClient()
  // FIXME(types): Database typegen doesn't include this RPC yet (see
  // 074_get_teacher_dashboard migration). Cast keeps the rest of the
  // module fully typed.
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

// --- Cached wrapper ------------------------------------------
// 30s TTL — same horizon as the page's own `revalidate = 30`,
// so consecutive renders within a navigation burst share state
// without hitting Postgres. mutation endpoints invalidate the
// tag for instant fresh-read when something the teacher will
// notice changes (new lesson booked, recording finalized, etc).
export function getCachedTeacherDashboard(
  userId: string,
): Promise<TeacherDashboard | null> {
  return unstable_cache(
    async (uid: string) => loadTeacherDashboard(uid),
    ['teacher-dashboard', userId],
    { tags: [teacherDashboardTag(userId)], revalidate: 120 },
  )(userId)
}
