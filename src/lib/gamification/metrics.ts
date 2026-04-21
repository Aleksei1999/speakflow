// @ts-nocheck
// Compute all metrics used by achievement thresholds and reward claim_criteria.
// Kept together so achievements and rewards see the same numbers.

export type UserMetrics = {
  current_streak: number
  longest_streak: number
  total_xp: number
  clubs_attended: number
  clubs_attended_by_category: Record<string, number>
  clubs_attended_categories_distinct: number
  platform_days: number
  best_leaderboard_rank: number | null // lowest (best) rank across all periods
  xp_today: number
  xp_this_week: number
  // extended metrics for levels/community/special achievements
  lessons_completed: number
  invites_accepted: number
  best_level_test_score_pct: number
}

export async function computeUserMetrics(
  supabase: any,
  userId: string
): Promise<UserMetrics> {
  const [
    progressRes,
    profileRes,
    attendedRes,
    xpTodayRes,
    xpWeekRes,
    lbRes,
    lessonsRes,
    invitesRes,
    levelTestsRes,
  ] = await Promise.all([
    supabase
      .from('user_progress')
      .select('current_streak, longest_streak, total_xp')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('club_registrations')
      .select('club:clubs!inner ( category )')
      .eq('user_id', userId)
      .eq('status', 'attended'),
    supabase
      .from('xp_events')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    supabase
      .from('xp_events')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
    // Best rank across matviews. No FK → fetch per table and pick min.
    Promise.all([
      supabase.from('leaderboard_weekly').select('rank').eq('user_id', userId).maybeSingle(),
      supabase.from('leaderboard_monthly').select('rank').eq('user_id', userId).maybeSingle(),
      supabase.from('leaderboard_all_time').select('rank').eq('user_id', userId).maybeSingle(),
    ]),
    // Completed lessons as a student
    supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .eq('status', 'completed'),
    // Accepted friend invites where this user is the requester (outgoing requests accepted).
    // user_friends.status='accepted' acts as our invite-accepted signal until a dedicated
    // referrals/invites table exists. TODO: replace with a real referral writer.
    supabase
      .from('user_friends')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted'),
    // Level test scores — take best percentage. total_questions column may or may not exist.
    supabase
      .from('level_tests')
      .select('score, total_questions')
      .eq('user_id', userId),
  ])

  const progress = progressRes.data ?? null
  const profile = profileRes.data ?? null

  const clubsByCat: Record<string, number> = {}
  let clubsAttended = 0
  for (const r of attendedRes.data ?? []) {
    const cat = r?.club?.category ?? 'other'
    clubsByCat[cat] = (clubsByCat[cat] ?? 0) + 1
    clubsAttended += 1
  }
  const clubsCategoriesDistinct = Object.keys(clubsByCat).length

  const xpToday = (xpTodayRes.data ?? []).reduce(
    (acc: number, e: any) => acc + (e.amount ?? 0),
    0
  )
  const xpWeek = (xpWeekRes.data ?? []).reduce(
    (acc: number, e: any) => acc + (e.amount ?? 0),
    0
  )

  const ranks = (lbRes as any[])
    .map((r) => r?.data?.rank)
    .filter((v): v is number => typeof v === 'number')
  const bestRank = ranks.length > 0 ? Math.min(...ranks) : null

  const platformDays = profile?.created_at
    ? Math.floor(
        (Date.now() - new Date(profile.created_at).getTime()) / (24 * 3600 * 1000)
      )
    : 0

  const lessonsCompleted = lessonsRes?.count ?? 0
  const invitesAccepted = invitesRes?.count ?? 0

  let bestLevelTestPct = 0
  for (const row of levelTestsRes?.data ?? []) {
    const score = Number(row?.score ?? 0)
    const total = Number(row?.total_questions ?? 0)
    const pct = total > 0 ? Math.round((score * 100) / total) : 0
    if (pct > bestLevelTestPct) bestLevelTestPct = pct
  }

  return {
    current_streak: progress?.current_streak ?? 0,
    longest_streak: progress?.longest_streak ?? 0,
    total_xp: progress?.total_xp ?? 0,
    clubs_attended: clubsAttended,
    clubs_attended_by_category: clubsByCat,
    clubs_attended_categories_distinct: clubsCategoriesDistinct,
    platform_days: platformDays,
    best_leaderboard_rank: bestRank,
    xp_today: xpToday,
    xp_this_week: xpWeek,
    lessons_completed: lessonsCompleted,
    invites_accepted: invitesAccepted,
    best_level_test_score_pct: bestLevelTestPct,
  }
}

// ==========================================================
// Reward claim_criteria matcher
// ==========================================================
// Supported shapes (from migration 016):
//   { streak: N }                — current_streak >= N
//   { longest_streak: N }        — longest_streak >= N
//   { total_xp: N }
//   { clubs_attended: N }
//   { platform_days: N }
//   { leaderboard_rank_max: N }  — best_rank <= N (lower is better)
//   { daily_challenge_streak: N } — not yet tracked → always false
//   { any: [...] } / { all: [...] }
export function evaluateClaimCriteria(criteria: any, m: UserMetrics): boolean {
  if (!criteria || typeof criteria !== 'object') return false
  if (Array.isArray(criteria.any)) return criteria.any.some((c: any) => evaluateClaimCriteria(c, m))
  if (Array.isArray(criteria.all)) return criteria.all.every((c: any) => evaluateClaimCriteria(c, m))

  if (typeof criteria.streak === 'number') return m.current_streak >= criteria.streak
  if (typeof criteria.longest_streak === 'number') return m.longest_streak >= criteria.longest_streak
  if (typeof criteria.total_xp === 'number') return m.total_xp >= criteria.total_xp
  if (typeof criteria.clubs_attended === 'number') return m.clubs_attended >= criteria.clubs_attended
  if (typeof criteria.platform_days === 'number') return m.platform_days >= criteria.platform_days
  if (typeof criteria.leaderboard_rank_max === 'number') {
    return m.best_leaderboard_rank !== null && m.best_leaderboard_rank <= criteria.leaderboard_rank_max
  }
  if (typeof criteria.daily_challenge_streak === 'number') return false

  return false
}

// ==========================================================
// Achievement progress evaluator (slug/category-based)
// ==========================================================
// Returns numeric current_value for any achievement slug; UI compares against `threshold`.
export function evaluateAchievementProgress(
  slug: string,
  category: string,
  m: UserMetrics,
  threshold: number = 0
): number {
  // Streak achievements: highest achieved streak ever (so earned ones stay earned)
  if (category === 'streak') return m.longest_streak

  // XP — total lifetime XP unless the slug names a window
  if (category === 'xp') {
    if (slug === 'xp_centurion') return m.xp_today // "100 XP за один день"
    if (slug === 'xp_machine') return m.xp_this_week // "500 XP за неделю"
    if (slug === 'xp_daily_champion') return 0 // daily_challenge not tracked yet
    return m.total_xp
  }

  // Speaking clubs — total attended, with special slugs filtering by category
  if (category === 'speaking') {
    if (slug === 'speak_wine_connoisseur') return m.clubs_attended_by_category['wine'] ?? 0
    if (slug === 'speak_debate_king') return m.clubs_attended_by_category['debate'] ?? 0
    return m.clubs_attended
  }

  // LEVELS — XP thresholds on the 5 level tiers + Speed Runner
  if (category === 'levels') {
    if (slug === 'level_speed_runner') return 0 // TODO: needs per-level up timestamp
    return m.total_xp
  }

  // COMMUNITY — invites, leaderboard rank, mentor
  if (category === 'community') {
    if (
      slug === 'comm_recruiter' ||
      slug === 'comm_ambassador' ||
      slug === 'comm_community_builder'
    ) {
      return m.invites_accepted
    }
    if (slug === 'comm_top_3' || slug === 'comm_champion') {
      // threshold is a rank (1 or 3). best_leaderboard_rank lower-is-better.
      // Return full threshold when earned, else 0 (binary progress).
      return m.best_leaderboard_rank !== null && m.best_leaderboard_rank <= threshold
        ? threshold
        : 0
    }
    if (slug === 'comm_mentor') return 0 // TODO: no referrer→student level link yet
    return 0
  }

  // SPECIAL — one-offs
  if (category === 'special') {
    if (slug === 'spec_perfect_score') return m.best_level_test_score_pct
    if (slug === 'spec_bookworm') return m.lessons_completed
    if (slug === 'spec_anniversary') return m.platform_days
    if (slug === 'spec_all_rounder') return m.clubs_attended_categories_distinct
    if (slug === 'spec_early_bird') return 0 // TODO: no "registered within 5min of club creation" signal
    if (slug === 'spec_polyglot') return 0 // TODO: no native-speaker flag on teachers/club hosts
    return 0
  }

  return 0
}
