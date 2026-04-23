// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// GET /api/referrals/verify?code=XXX
// PUBLIC — used by /register to preview "+50 XP bonus" if the code is valid.
// Never reveals PII: returns only a display name (first name or fallback).
//
// Rate limiting: naive in-memory token bucket keyed by IP. 10 req/min/IP.
// For a multi-instance deploy this should be migrated to Upstash/Redis — good
// enough for the MVP single-region Vercel setup.
// ---------------------------------------------------------------------------

const BONUS_XP = 50
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

function hitRateLimit(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  b.count += 1
  if (b.count > MAX_PER_WINDOW) return true
  return false
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown'
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

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
    const ip = getClientIp(request)
    if (hitRateLimit(ip)) {
      return NextResponse.json(
        { valid: false, error: 'Слишком много запросов, попробуйте через минуту' },
        { status: 429 }
      )
    }

    const url = new URL(request.url)
    const raw = (url.searchParams.get('code') ?? '').trim().toUpperCase()

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

    // Service role — the public user can't SELECT other profiles via RLS.
    const admin = createAdminClient()
    const { data: inviter, error } = await admin
      .from('profiles')
      .select('id, first_name, last_name, full_name')
      .eq('invite_code', raw)
      .maybeSingle()

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
