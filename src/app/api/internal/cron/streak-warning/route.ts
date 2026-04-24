// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'
import { moscowDateKey } from '@/lib/time'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron: streak warning — runs 20:00 MSK (17:00 UTC).
 *
 * Finds students with an active streak whose last streak-extending
 * activity was NOT today (Moscow TZ). They risk breaking the streak
 * at midnight; we DM them 4 hours before.
 *
 * Idempotent: skips users who already got a `streak_warning` today.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const now = new Date()
  const todayMoscowKey = moscowDateKey(now)
  const todayUtcStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  )).toISOString()

  // Pull all students with an active streak. Schema ref (014/022):
  //   user_progress: current_streak, last_lesson_date (DATE)
  //   profiles:      notification_prefs.streak_warning
  const { data: progressRows, error: progError } = await supabase
    .from('user_progress')
    .select('user_id, current_streak, last_lesson_date')
    .gt('current_streak', 0)

  if (progError) {
    console.error('[cron/streak-warning] user_progress error:', progError)
    return NextResponse.json(
      { ok: false, error: progError.message },
      { status: 500 }
    )
  }

  if (!progressRows || progressRows.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0, skipped: 0 })
  }

  // Filter by "last activity NOT today (Moscow)".
  const atRiskIds: Array<{ userId: string; streak: number }> = []
  for (const r of progressRows) {
    const last = r.last_lesson_date ? String(r.last_lesson_date) : null
    // last_lesson_date stored as date (yyyy-mm-dd) — compare to today's Moscow key.
    if (last !== todayMoscowKey) {
      atRiskIds.push({ userId: r.user_id, streak: r.current_streak })
    }
  }

  if (atRiskIds.length === 0) {
    return NextResponse.json({ ok: true, candidates: 0, sent: 0, skipped: 0 })
  }

  const userIds = atRiskIds.map((x) => x.userId)

  // Check notification_prefs and role.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, is_active, notification_prefs')
    .in('id', userIds)

  const profileById = new Map<string, any>(
    (profiles || []).map((p: any) => [p.id, p])
  )

  // Users who already got streak_warning today.
  const { data: alreadySent } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('type', 'streak_warning')
    .gte('created_at', todayUtcStart)
    .in('user_id', userIds)

  const sentSet = new Set<string>((alreadySent || []).map((r: any) => r.user_id))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const { userId, streak } of atRiskIds) {
    const profile = profileById.get(userId)
    if (!profile) {
      skipped++
      continue
    }
    if (profile.role !== 'student' || profile.is_active === false) {
      skipped++
      continue
    }
    const pref = profile?.notification_prefs?.streak_warning
    if (pref === false || pref === 'false') {
      skipped++
      continue
    }
    if (sentSet.has(userId)) {
      skipped++
      continue
    }

    try {
      await sendNotification(userId, 'streak_warning', {
        streak_days: streak,
        ctaUrl: `${appUrl}/student`,
      })
      sent++
    } catch (err: any) {
      const msg = `streak_warning failed user=${userId}: ${err?.message || err}`
      console.error(`[cron/streak-warning] ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: atRiskIds.length,
    sent,
    skipped,
    errors: errors.length ? errors : undefined,
  })
}
