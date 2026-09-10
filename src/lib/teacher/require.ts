// ---------------------------------------------------------------------------
// Shared `requireTeacher` / `tryGetTeacher` helper.
// Вынесен из calendar-actions.ts, т.к. одна и та же проверка нужна
// и в lesson-actions.ts, и в любых будущих teacher server-actions.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin"
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

/** teacher_profiles.id по auth user id (через service role). */
export async function resolveTeacherProfileId(userId: string): Promise<string | null> {
  const admin = createAdminClient() as unknown as { from: (t: string) => any }
  const { data } = await admin.from("teacher_profiles").select("id").eq("user_id", userId).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}
