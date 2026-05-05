// ============================================================
// Dashboard layout cache
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
// IMPORTANT: `unstable_cache` callbacks must NOT touch the auth
// cookie context (cookies()/auth.getUser()). We use the service
// role admin client inside, and the userId argument is the
// only cache key — RLS bypass is fine because the caller has
// already authenticated upstream.
// ============================================================
import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// --- Tag helpers --------------------------------------------
export const profileTag = (userId: string) => `profile-${userId}`
export const progressTag = (userId: string) => `progress-${userId}`
export const teacherStatsTag = (userId: string) => `teacher-stats-${userId}`

// --- Types --------------------------------------------------
export type CachedProfile = {
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin' | null
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
    .select('full_name, avatar_url, role')
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
    { tags: [progressTag(userId)], revalidate: 30 }
  )(userId)
}

export function getCachedTeacherStats(userId: string): Promise<CachedTeacherStats> {
  return unstable_cache(
    async (uid: string) => loadTeacherStats(uid),
    ['dashboard-teacher-stats', userId],
    { tags: [teacherStatsTag(userId)], revalidate: 60 }
  )(userId)
}
