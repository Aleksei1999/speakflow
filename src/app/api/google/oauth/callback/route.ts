// ---------------------------------------------------------------------------
// GET /api/google/oauth/callback
//
// Обменивает `code` на access+refresh токены, сохраняет в БД
// (через service_role), редиректит обратно на /teacher.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  decodeEmailFromIdToken,
  exchangeCodeForTokens,
  saveTokensForUser,
} from '@/lib/google-calendar/client'
import { verifyState } from '@/lib/google-calendar/state'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000')
}

function redirectWith(status: 'ok' | 'error', reason?: string) {
  const url = new URL('/teacher', appUrl())
  url.searchParams.set('gcal', status)
  if (reason) url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err) return redirectWith('error', err)
  if (!code || !state) return redirectWith('error', 'missing_code_or_state')

  const payload = verifyState(state)
  if (!payload) return redirectWith('error', 'invalid_state')

  try {
    const tokens = await exchangeCodeForTokens(code)
    const email = decodeEmailFromIdToken(tokens.id_token)
    await saveTokensForUser({
      userId: payload.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      googleEmail: email,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'oauth_callback_failed'
    // Скрываем детали в URL, но пишем в лог для дебага.
    console.error('[google-oauth-callback]', message)
    return redirectWith('error', 'exchange_failed')
  }

  return redirectWith('ok')
}
