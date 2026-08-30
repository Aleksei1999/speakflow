// ---------------------------------------------------------------------------
// Shared `requireTeacher` / `tryGetTeacher` helper.
// Вынесен из calendar-actions.ts, т.к. одна и та же проверка нужна
// и в lesson-actions.ts, и в любых будущих teacher server-actions.
// ---------------------------------------------------------------------------

import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface TeacherAuth {
  supabase: SupabaseServerClient
  userId: string
}

/**
 * Требует авторизованного teacher/admin. Кидает Error при отсутствии сессии
 * либо недостаточной роли. Используется в server actions.
 */
export async function requireTeacher(): Promise<TeacherAuth> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (pErr || !profile) throw new Error('Profile not found')
  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    throw new Error('Forbidden: teacher role required')
  }
  return { supabase, userId: user.id as string }
}

/** Non-throwing вариант — вернёт null, если юзер не залогинен / не teacher. */
export async function tryGetTeacher(): Promise<TeacherAuth | null> {
  try {
    return await requireTeacher()
  } catch {
    return null
  }
}
