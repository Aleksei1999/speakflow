// ============================================================
// Per-request cached role lookup for Server Components.
// ------------------------------------------------------------
// Why this exists:
//   - middleware.ts already caches the role in a signed cookie
//     (`rwen_role` via lib/auth/role-cache.ts) AND in a public
//     hint cookie (`rwen_authed`) for the landing.
//   - (dashboard)/layout.tsx already loads the profile (with
//     role) via `getCachedProfile` (unstable_cache, TTL 60s).
//   - But individual pages like /student/materials and /admin
//     used to do their *own* `from('profiles').select('role')`
//     read on every render — a redundant Supabase round-trip
//     that adds 30-80ms per page-load.
//
// `getCachedRole(userId)` wraps `getCachedProfile` in React's
// per-request `cache()` so the layout + any page in the same
// render tree share a single in-memory resolution. The first
// caller pays the (already-cached) Supabase read, subsequent
// callers in the same RSC render get the value for free.
//
// IMPORTANT: callers must pass the *authenticated* user.id —
// this helper does NOT do auth itself. Always do
// `supabase.auth.getUser()` first, then `getCachedRole(user.id)`.
// ============================================================
import 'server-only'

import { cache } from 'react'
import { getCachedProfile } from '@/lib/cache/dashboard'

export type Role = 'student' | 'teacher' | 'admin' | null

/**
 * Returns the user's role for the current request, sharing the
 * result across all `Server Component`s rendered in the same
 * pass. Backed by `unstable_cache` (TTL 60s, tag-invalidated on
 * settings save / role change) — see lib/cache/dashboard.ts.
 *
 * Returns `null` for unknown user / missing profile row.
 */
export const getCachedRole = cache(async (userId: string): Promise<Role> => {
  const profile = await getCachedProfile(userId)
  return (profile?.role as Role) ?? null
})
