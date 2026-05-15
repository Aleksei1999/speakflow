import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { verifyTurnstile } from '@/lib/api/turnstile'

// GET /api/referrals/verify?code=XXX&t=TURNSTILE_TOKEN (token опционален)
// Публичный — /register показывает "+50 XP" если код валидный.
// Если turnstile-token есть, проверяем его и пропускаем без RL.
// Без токена — DB rate-limit 10/мин по IP (через postgres, работает
// между всеми Vercel-инстансами).

const BONUS_XP = 50

function isValidCodeShape(code: string): boolean {
  // 8 chars, base32 alphabet used by generate_invite_code(): no 0/1/I/L/O/U.
  return /^[A-Z2-9]{8}$/.test(code)
}

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    const trimmed = (v ?? '').trim()
    if (trimmed) return trimmed
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const raw = (url.searchParams.get('code') ?? '').trim().toUpperCase()
    const turnstileToken = url.searchParams.get('t')

    // Если есть turnstile-token и он валиден — пропускаем без RL.
    // Иначе — обычный 10/мин per IP.
    const cap = await verifyTurnstile(turnstileToken, getClientIp(request))
    if (!cap.ok) {
      const limited = await enforceRateLimit(request, {
        name: 'referrals:verify',
        keyParts: [getClientIp(request)],
        max: 10,
        windowSeconds: 60,
      })
      if (limited) return limited
    }

    if (!raw) {
      return NextResponse.json(
        { valid: false, error: 'Код не указан', bonus_xp: BONUS_XP },
        { status: 400 }
      )
    }

    if (!isValidCodeShape(raw)) {
      // Don't leak whether the code "shape" was wrong vs unknown.
      return NextResponse.json({ valid: false, bonus_xp: BONUS_XP })
    }

    // FIXME(types): profiles Row in Database type lacks first_name/last_name/invite_code
    // Service role — the public user can't SELECT other profiles via RLS.
    const admin = createAdminClient()
    const { data: inviter, error } = (await (admin as any)
      .from('profiles')
      .select('id, first_name, last_name, full_name')
      .eq('invite_code', raw)
      .maybeSingle()) as { data: { id: string; first_name: string | null; last_name: string | null; full_name: string | null } | null; error: any }

    if (error) {
      console.error('referrals/verify lookup error:', error)
      return NextResponse.json({ valid: false, bonus_xp: BONUS_XP })
    }

    if (!inviter) {
      return NextResponse.json({ valid: false, bonus_xp: BONUS_XP })
    }

    const displayName =
      firstNonEmpty(inviter.first_name, inviter.full_name?.split(' ')[0]) ??
      'друг'

    return NextResponse.json({
      valid: true,
      inviter_name: displayName,
      bonus_xp: BONUS_XP,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/referrals/verify:', err)
    return NextResponse.json(
      { valid: false, bonus_xp: BONUS_XP, error: 'Внутренняя ошибка' },
      { status: 500 }
    )
  }
}
