// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'
import {
  formatLessonDayLong,
  formatLessonTime,
} from '@/lib/time'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron: lesson reminders — runs every 5 minutes.
 *
 * Selects lessons starting in the +25..+35 min window (10-min slack)
 * to ensure at least one tick covers each lesson. Idempotent via the
 * notifications log: we skip if a `lesson_reminder` was already logged
 * for (user_id, lesson_id) in the last 6 hours.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const fromIso = new Date(now.getTime() + 25 * 60 * 1000).toISOString()
  const toIso = new Date(now.getTime() + 35 * 60 * 1000).toISOString()

  const UPCOMING_STATUSES = [
    'scheduled',
    'confirmed',
    'booked',
    'pending_payment',
    'in_progress',
  ]

  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, scheduled_at, duration_minutes, student_id, teacher_id')
    .in('status', UPCOMING_STATUSES)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)

  if (lessonsError) {
    console.error('[cron/lesson-reminders] query error:', lessonsError)
    return NextResponse.json(
      { ok: false, error: lessonsError.message },
      { status: 500 }
    )
  }

  if (!lessons || lessons.length === 0) {
    return NextResponse.json({ ok: true, lessons: 0, sent: 0, skipped: 0 })
  }

  // Pre-fetch profile names once.
  const userIds = new Set<string>()
  for (const l of lessons) {
    userIds.add(l.student_id)
    userIds.add(l.teacher_id)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', Array.from(userIds))

  const nameById = new Map<string, string>(
    (profiles || []).map((p: any) => [p.id, p.full_name])
  )

  // Idempotency horizon: 6 hours back.
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const lesson of lessons) {
    const dateStr = formatLessonDayLong(lesson.scheduled_at)
    const timeStr = formatLessonTime(lesson.scheduled_at)
    const joinUrl = `${appUrl}/lesson/${lesson.id}`
    const studentName = nameById.get(lesson.student_id) || ''
    const teacherName = nameById.get(lesson.teacher_id) || 'Преподаватель'

    for (const recipientId of [lesson.student_id, lesson.teacher_id]) {
      // Skip if already logged for this (user, lesson) in the last 6h.
      const { data: already } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'lesson_reminder')
        .eq('user_id', recipientId)
        .filter('data->>lesson_id', 'eq', lesson.id)
        .gte('created_at', sixHoursAgo)
        .limit(1)

      if (already && already.length > 0) {
        skipped++
        continue
      }

      const isStudent = recipientId === lesson.student_id
      try {
        await sendNotification(recipientId, 'lesson_reminder', {
          lesson_id: lesson.id,
          name: isStudent ? studentName : teacherName,
          teacher_name: teacherName,
          teacherOrStudentName: isStudent ? teacherName : studentName,
          date: dateStr,
          time: timeStr,
          duration: lesson.duration_minutes,
          joinUrl,
        })
        sent++
      } catch (err: any) {
        const msg = `reminder failed user=${recipientId} lesson=${lesson.id}: ${err?.message || err}`
        console.error(`[cron/lesson-reminders] ${msg}`)
        errors.push(msg)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    lessons: lessons.length,
    sent,
    skipped,
    errors: errors.length ? errors : undefined,
  })
}
