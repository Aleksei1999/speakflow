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

  // Пускаем teacher/admin/student — все могут привязать личный Google Calendar,
  // чтобы уроки автоматически появлялись у обеих сторон.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()
  const role = profile?.role
  if (!role || (role !== 'teacher' && role !== 'admin' && role !== 'student')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
