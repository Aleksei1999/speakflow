// ============================================================
// Cache invalidation helpers
// ------------------------------------------------------------
// Thin wrappers around `revalidateTag` so call-sites don't have
// to know about tag naming conventions. Keeping the tag format
// in one file means renames stay consistent.
//
// Next.js 16 changed `revalidateTag` to require a profile arg
// (string profile name or `{ expire }` object). We pass the
// `'default'` profile — the cache entries themselves still
// honour their own `revalidate` TTL set in unstable_cache.
// ============================================================
import 'server-only'

import { revalidateTag } from 'next/cache'
import { profileTag, progressTag, teacherStatsTag } from './dashboard'

const PROFILE = 'default'

/** Profile fields shown in the dashboard sidebar (full_name, avatar_url, role). */
export function invalidateProfile(userId: string): void {
  if (!userId) return
  try {
    revalidateTag(profileTag(userId), PROFILE)
  } catch (err) {
    // revalidateTag should never throw in normal flow, but log defensively
    console.error('[cache] revalidateTag profile failed', err)
  }
}

/** Student gamification: total_xp, english_level, current_streak. */
export function invalidateUserProgress(userId: string): void {
  if (!userId) return
  try {
    revalidateTag(progressTag(userId), PROFILE)
  } catch (err) {
    console.error('[cache] revalidateTag progress failed', err)
  }
}

/** Teacher hero stats: rating, total_reviews, experience_years. */
export function invalidateTeacherStats(userId: string): void {
  if (!userId) return
  try {
    revalidateTag(teacherStatsTag(userId), PROFILE)
  } catch (err) {
    console.error('[cache] revalidateTag teacher-stats failed', err)
  }
}
