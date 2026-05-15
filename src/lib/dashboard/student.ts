// ============================================================
// Student dashboard — single-RPC snapshot loader
// ------------------------------------------------------------
// Раньше (dashboard)/student/page.tsx делал ~11 параллельных
// Supabase round-trip'ов + 3 follow-up'а (trial teachers /
// referrals / embeds). Это RPC `public.get_student_dashboard`
// (миграция 073) собирает всё за один SQL и возвращает JSONB.
//
// SECURITY DEFINER + явная проверка auth.uid() внутри функции,
// поэтому здесь безопасно использовать `createAdminClient` —
// RLS обходится сознательно: аутентификация уже прошла на
// уровне server-component, а RPC сам валидирует caller'а.
//
// Кеш — per-user `unstable_cache` с тегом `student-dashboard-<uid>`.
// TTL=30s совпадает с прежним `revalidate=30` на странице.
// ============================================================
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// ---- Tag helper ---------------------------------------------
export const studentDashboardTag = (userId: string): string =>
  `student-dashboard-${userId}`

// ---- Types --------------------------------------------------
export type StudentDashboardProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  email: string
  created_at: string
  first_name: string | null
  last_name: string | null
} | null

export type StudentDashboardProgress = {
  total_xp: number
  english_level: string | null
  current_streak: number
  longest_streak: number
  current_level: number
  lessons_completed: number
  last_lesson_date: string | null
  updated_at: string
} | null

export type StudentDashboardStats = {
  total_lessons: number
  completed: number
  cancelled: number
  upcoming: number
  completed_30d: number
  month_total: number
}

export type StudentDashboardUpcomingLesson = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher_id: string | null
  teacher_user_id: string | null
  teacher_name: string | null
  teacher_avatar: string | null
  room_name: string | null
}

export type StudentDashboardAchievementDef = {
  id: string
  slug: string
  title: string
  description: string | null
  icon_emoji: string | null
  icon_url: string | null
  rarity: string
  sort_order: number
  xp_reward: number
  category: string
}

export type StudentDashboardEarnedAchievement = {
  achievement_id: string
  earned_at: string
}

export type StudentDashboardLeaderboardRow = {
  out_rank: number
  out_user_id: string
  out_xp: number
  out_full_name: string | null
  out_avatar_url: string | null
  out_english_level: string | null
  out_current_streak: number
  out_longest_streak: number
  out_clubs_attended: number
}

export type StudentDashboardXpEvent = {
  id: string
  amount: number
  source_type: string
  source_id: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type StudentDashboardTrialRequest = {
  id: string
  status: string
  preferred_slot: string | null
  assigned_lesson_id: string | null
  assigned_teacher_id: string | null
  created_at: string
  updated_at: string
} | null

export type StudentDashboardReferral = {
  invite_code: string | null
  activated_count: number
  pending_count: number
}

export type StudentDashboard = {
  profile: StudentDashboardProfile
  progress: StudentDashboardProgress
  stats: StudentDashboardStats
  upcoming_lessons: StudentDashboardUpcomingLesson[]
  achievement_defs: StudentDashboardAchievementDef[]
  achievements_earned: StudentDashboardEarnedAchievement[]
  leaderboard_weekly: StudentDashboardLeaderboardRow[]
  recent_xp_events: StudentDashboardXpEvent[]
  xp_events_week: Array<{ created_at: string }>
  trial_request: StudentDashboardTrialRequest
  referral: StudentDashboardReferral
  generated_at: string
}

// ---- Uncached impl ------------------------------------------
async function loadStudentDashboardImpl(
  userId: string
): Promise<StudentDashboard> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any).rpc('get_student_dashboard', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[loadStudentDashboard]', error)
    throw new Error(`get_student_dashboard failed: ${error.message}`)
  }
  // RPC всегда возвращает заполненный JSONB; на всякий случай добиваем
  // дефолты, чтобы page.tsx не падал при пустых полях у нового студента.
  const d = (data ?? {}) as Partial<StudentDashboard>
  return {
    profile: d.profile ?? null,
    progress: d.progress ?? null,
    stats: d.stats ?? {
      total_lessons: 0,
      completed: 0,
      cancelled: 0,
      upcoming: 0,
      completed_30d: 0,
      month_total: 0,
    },
    upcoming_lessons: d.upcoming_lessons ?? [],
    achievement_defs: d.achievement_defs ?? [],
    achievements_earned: d.achievements_earned ?? [],
    leaderboard_weekly: d.leaderboard_weekly ?? [],
    recent_xp_events: d.recent_xp_events ?? [],
    xp_events_week: d.xp_events_week ?? [],
    trial_request: d.trial_request ?? null,
    referral: d.referral ?? {
      invite_code: null,
      activated_count: 0,
      pending_count: 0,
    },
    generated_at: d.generated_at ?? new Date().toISOString(),
  }
}

// ---- Cached wrapper ------------------------------------------
export function getCachedStudentDashboard(
  userId: string
): Promise<StudentDashboard> {
  return unstable_cache(
    async (uid: string) => loadStudentDashboardImpl(uid),
    ['student-dashboard', userId],
    { tags: [studentDashboardTag(userId)], revalidate: 120 }
  )(userId)
}
