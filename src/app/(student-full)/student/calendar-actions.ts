"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hasGoogleCalendar } from '@/lib/google-calendar/client'

export interface StudentCalendarConnection {
  connected: boolean
  googleEmail: string | null
  syncedAt: string | null
}

async function requireStudentUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthenticated')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()
  if (profile?.role !== 'student') throw new Error('forbidden')
  return user.id
}

export async function getStudentCalendarConnection(): Promise<StudentCalendarConnection> {
  try {
    const userId = await requireStudentUserId()
    return hasGoogleCalendar(userId)
  } catch {
    return { connected: false, googleEmail: null, syncedAt: null }
  }
}

export async function disconnectStudentGoogleCalendar(): Promise<{ ok: true }> {
  const userId = await requireStudentUserId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin
    .from('google_calendar_tokens')
    .delete()
    .eq('user_id', userId)
  if (error) throw new Error(`disconnectStudentGoogleCalendar: ${error.message}`)
  return { ok: true }
}
