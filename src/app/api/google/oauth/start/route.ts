// ---------------------------------------------------------------------------
// GET /api/google/oauth/start
//
// Инициирует OAuth 2.0 flow для Google Calendar: генерит HMAC-подписанный
// state (с зашитым user_id) и редиректит на consent screen.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizationUrl } from '@/lib/google-calendar/client'
import { signState } from '@/lib/google-calendar/state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  // Пускаем только teacher/admin — обычный student не должен подключать календарь.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden: teacher role required' }, { status: 403 })
  }

  let redirectUrl: string
  try {
    const state = signState(user.id)
    redirectUrl = buildAuthorizationUrl(state)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth start failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.redirect(redirectUrl)
}
