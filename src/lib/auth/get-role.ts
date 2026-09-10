// Роль пользователя с per-request React `cache()` поверх getCachedProfile:
// layout и страницы одного RSC-рендера делят один результат.
//
// IMPORTANT: helper не делает auth — передавать только user.id из
// `supabase.auth.getUser()`.
import 'server-only'

import { cache } from 'react'
import { getCachedProfile } from '@/lib/cache/dashboard'

export type Role = 'student' | 'teacher' | 'admin' | null

/** Роль для текущего запроса; `null` — нет профиля. */
export const getCachedRole = cache(async (userId: string): Promise<Role> => {
  const profile = await getCachedProfile(userId)
  return (profile?.role as Role) ?? null
})
