// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron: daily challenge push — runs 09:00 MSK (06:00 UTC).
 *
 * Sends a `daily_challenge` notification to every student who:
 *   - has notification_prefs->>'daily_challenge' not explicitly 'false'
 *   - has not yet received a `daily_challenge` notification today
 *   - has not already completed today's daily challenge (xp_events source='daily_challenge' today)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  // Moscow "today" boundary expressed in UTC ISO for SQL comparisons.
  // Simpler & safe: use UTC day start (cron fires at 06:00 UTC anyway; if
  // we re-run within same UTC day no double-send).
  const now = new Date()
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
  )).toISOString()

  // Eligible students.
  const { data: students, error: studentsError } = await supabase
    .from('profiles')
    .select('id, notification_prefs, is_active')
    .eq('role', 'student')
    .eq('is_active', true)

  if (studentsError) {
    console.error('[cron/daily-challenge] profiles error:', studentsError)
    return NextResponse.json(
      { ok: false, error: studentsError.message },
      { status: 500 }
    )
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ ok: true, eligible: 0, sent: 0, skipped: 0 })
  }

  // Filter out users who opted out.
  const optedInIds: string[] = []
  for (const s of students) {
    const pref = s?.notification_prefs?.daily_challenge
    if (pref === false || pref === 'false') continue
    optedInIds.push(s.id)
  }

  if (optedInIds.length === 0) {
    return NextResponse.json({ ok: true, eligible: 0, sent: 0, skipped: 0 })
  }

  // Users who already got today's notification.
  const { data: alreadyNotified } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('type', 'daily_challenge')
    .gte('created_at', todayStart)
    .in('user_id', optedInIds)

  const notifiedSet = new Set<string>((alreadyNotified || []).map((r: any) => r.user_id))

  // Users who already earned daily_challenge XP today.
  const { data: alreadyCompleted } = await supabase
    .from('xp_events')
    .select('user_id')
    .eq('source_type', 'daily_challenge')
    .gte('created_at', todayStart)
    .in('user_id', optedInIds)

  const completedSet = new Set<string>((alreadyCompleted || []).map((r: any) => r.user_id))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const userId of optedInIds) {
    if (notifiedSet.has(userId) || completedSet.has(userId)) {
      skipped++
      continue
    }
    try {
      await sendNotification(userId, 'daily_challenge', {
        ctaUrl: `${appUrl}/student`,
      })
      sent++
    } catch (err: any) {
      const msg = `daily_challenge failed user=${userId}: ${err?.message || err}`
      console.error(`[cron/daily-challenge] ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json({
    ok: true,
    eligible: optedInIds.length,
    sent,
    skipped,
    errors: errors.length ? errors : undefined,
  })
}
