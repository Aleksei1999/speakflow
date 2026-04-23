// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// GET /api/referrals/me
// Returns the authenticated user's invite code, share URL, referral stats,
// remaining cap slots, and the list of invitees (email masked).
// ---------------------------------------------------------------------------

const LIFETIME_CAP = 10

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return trimmed
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at)
  if (local.length <= 2) return `${local[0] ?? '*'}***${domain}`
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local.slice(-1)}${domain}`
}

function resolveShareBase(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    ''
  const trimmed = fromEnv.trim().replace(/\/+$/, '')
  return trimmed || 'https://raw-english.com'
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    // Invite code lives on profiles. If missing for any reason (old user that
    // predates 033) — allocate one on the fly via the SECURITY DEFINER RPC so
    // the dashboard never sees a NULL code.
    let { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('invite_code, first_name, last_name, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      console.error('referrals/me profile error:', profileErr)
      return NextResponse.json({ error: 'Не удалось загрузить профиль' }, { status: 500 })
    }

    if (profile && !profile.invite_code) {
      // Self-heal: allocate a fresh code via RPC (service_role only) — fall
      // back to a friendly message if the RPC is blocked for the caller.
      const { data: fresh } = await supabase.rpc('generate_invite_code')
      if (fresh) {
        await supabase.from('profiles').update({ invite_code: fresh }).eq('id', user.id)
        profile = { ...profile, invite_code: fresh }
      }
    }

    const code = profile?.invite_code ?? null

    // Pull the user's referrals ledger. Filtered by RLS (inviter_id = auth.uid()).
    const { data: referrals, error: refsErr } = await supabase
      .from('referrals')
      .select(
        'id, status, invited_email, registered_user_id, xp_awarded, created_at, registered_at, activated_at, expires_at'
      )
      .order('created_at', { ascending: false })

    if (refsErr) {
      console.error('referrals/me referrals error:', refsErr)
      return NextResponse.json({ error: 'Не удалось загрузить рефералы' }, { status: 500 })
    }

    const rows = referrals ?? []

    const stats = {
      sent: rows.filter((r) => r.status === 'sent').length,
      registered: rows.filter((r) => r.status === 'registered').length,
      activated: rows.filter((r) => r.status === 'activated').length,
      expired: rows.filter((r) => r.status === 'expired').length,
    }
    const cap_remaining = Math.max(0, LIFETIME_CAP - stats.activated)

    // Enrich registered invitees with their email (masked). Only fetch for
    // rows that have a registered_user_id and no stored invited_email.
    const inviteeIds = rows
      .map((r) => r.registered_user_id)
      .filter((x): x is string => Boolean(x))

    const emailMap = new Map<string, string>()
    if (inviteeIds.length > 0) {
      const { data: inviteeProfiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, full_name')
        .in('id', inviteeIds)
      for (const p of inviteeProfiles ?? []) {
        if (p?.email) emailMap.set(p.id, p.email)
      }
    }

    const invitees = rows.map((r) => {
      const rawEmail = r.invited_email ?? emailMap.get(r.registered_user_id ?? '') ?? null
      return {
        id: r.id,
        masked_email: maskEmail(rawEmail),
        status: r.status,
        created_at: r.created_at,
        registered_at: r.registered_at,
        activated_at: r.activated_at,
        xp_awarded: r.xp_awarded ?? 0,
      }
    })

    const totalXpEarned = rows.reduce((acc, r) => acc + (r.xp_awarded ?? 0), 0)

    const shareUrl = code
      ? `${resolveShareBase()}/register?ref=${encodeURIComponent(code)}`
      : null

    return NextResponse.json({
      code,
      share_url: shareUrl,
      stats: {
        sent: stats.sent,
        registered: stats.registered,
        activated: stats.activated,
        expired: stats.expired,
        total_xp_earned: totalXpEarned,
      },
      cap: {
        lifetime: LIFETIME_CAP,
        remaining: cap_remaining,
        reached: cap_remaining === 0,
      },
      invitees,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в /api/referrals/me:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
