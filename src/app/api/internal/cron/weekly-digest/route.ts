// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron: weekly digest — runs Sunday 18:00 MSK (15:00 UTC).
 *
 * Aggregates last-7-days activity per student:
 *   - week_xp:          sum(xp_events.amount)
 *   - lessons_attended: count(lessons with status='completed')
 *   - top_achievement:  most recent user_achievements row (title joined)
 *   - streak_days:      user_progress.current_streak
 *
 * Skips idle users (no lessons AND 0 XP). Honours
 * notification_prefs->>'email_digest' opt-out.
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
  const weekAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Eligible students who have NOT opted out of digest.
  const { data: students, error: studentsError } = await supabase
    .from('profiles')
    .select('id, notification_prefs, is_active')
    .eq('role', 'student')
    .eq('is_active', true)

  if (studentsError) {
    console.error('[cron/weekly-digest] profiles error:', studentsError)
    return NextResponse.json(
      { ok: false, error: studentsError.message },
      { status: 500 }
    )
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ ok: true, eligible: 0, sent: 0, skipped: 0 })
  }

  const optedInIds: string[] = []
  for (const s of students) {
    const pref = s?.notification_prefs?.email_digest
    if (pref === false || pref === 'false') continue
    optedInIds.push(s.id)
  }

  if (optedInIds.length === 0) {
    return NextResponse.json({ ok: true, eligible: 0, sent: 0, skipped: 0 })
  }

  // Bulk aggregates (one round-trip each).
  const { data: xpRows } = await supabase
    .from('xp_events')
    .select('user_id, amount, created_at')
    .in('user_id', optedInIds)
    .gte('created_at', weekAgoIso)

  const xpByUser = new Map<string, number>()
  for (const r of xpRows || []) {
    xpByUser.set(r.user_id, (xpByUser.get(r.user_id) || 0) + (r.amount || 0))
  }

  const { data: lessonRows } = await supabase
    .from('lessons')
    .select('student_id, status, scheduled_at')
    .eq('status', 'completed')
    .in('student_id', optedInIds)
    .gte('scheduled_at', weekAgoIso)

  const lessonsByUser = new Map<string, number>()
  for (const r of lessonRows || []) {
    lessonsByUser.set(r.student_id, (lessonsByUser.get(r.student_id) || 0) + 1)
  }

  const { data: achRows } = await supabase
    .from('user_achievements')
    .select('user_id, achievement_id, earned_at, achievement_definitions:achievement_id ( title )')
    .in('user_id', optedInIds)
    .gte('earned_at', weekAgoIso)
    .order('earned_at', { ascending: false })

  const topAchByUser = new Map<string, string>()
  for (const r of achRows || []) {
    if (topAchByUser.has(r.user_id)) continue
    const title = r?.achievement_definitions?.title
    if (title) topAchByUser.set(r.user_id, title)
  }

  const { data: progressRows } = await supabase
    .from('user_progress')
    .select('user_id, current_streak')
    .in('user_id', optedInIds)

  const streakByUser = new Map<string, number>()
  for (const r of progressRows || []) {
    streakByUser.set(r.user_id, r.current_streak || 0)
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const userId of optedInIds) {
    const week_xp = xpByUser.get(userId) || 0
    const lessons_attended = lessonsByUser.get(userId) || 0
    const top_achievement = topAchByUser.get(userId) || null
    const streak_days = streakByUser.get(userId) || 0

    // Skip idle users.
    if (week_xp <= 0 && lessons_attended === 0) {
      skipped++
      continue
    }

    try {
      await sendNotification(userId, 'weekly_digest', {
        week_xp,
        lessons_attended,
        top_achievement,
        streak_days,
        ctaUrl: `${appUrl}/student`,
      })
      sent++
    } catch (err: any) {
      const msg = `weekly_digest failed user=${userId}: ${err?.message || err}`
      console.error(`[cron/weekly-digest] ${msg}`)
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
