// @ts-nocheck
// GET /api/clubs/stats
// Aggregated stats for the /student/clubs page header cards:
//   1. weekCount         — published clubs starting within current ISO week
//   2. attendedThisMonth — distinct clubs the user has attended (or that have
//                          already ended while they were registered) this month
//   3. nextClub          — user's next upcoming registered club
//   4. xpThisMonth       — sum of club-related xp_events for this month
//
// Requires auth. Returns 401 for anon users.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Registrations that "count" as a held seat (paid or pending, not cancelled)
const ACTIVE_REG_STATUSES = ['registered', 'pending_payment', 'waitlist'] as const
// xp_events source_types emitted by the clubs subsystem
const CLUB_XP_SOURCES = ['club_joined', 'club_attended', 'club_completed'] as const

// ISO week: Monday 00:00 local → next Monday 00:00 local
function isoWeekBounds(now: Date): { start: Date; end: Date } {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sun … 6 = Sat
  const diffToMonday = (day + 6) % 7 // Mon → 0, Sun → 6
  const start = new Date(d)
  start.setDate(d.getDate() - diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start, end }
}

function monthBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  return { start, end }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const week = isoWeekBounds(now)
    const month = monthBounds(now)

    // Run independent queries in parallel
    const [
      weekCountRes,
      attendedRes,
      nextClubRes,
      xpRes,
    ] = await Promise.all([
      // 1. Published clubs starting this ISO week
      supabase
        .from('clubs')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .is('cancelled_at', null)
        .gte('starts_at', week.start.toISOString())
        .lt('starts_at', week.end.toISOString()),

      // 2. Distinct clubs user attended this month.
      //    Trust-worthy signal: registration.status = 'attended' OR the club
      //    already ended while the user had an active registration.
      //    We fetch the rows and dedupe client-side to avoid an extra SQL fn.
      supabase
        .from('club_registrations')
        .select('club_id, status, attended_at, club:clubs!inner(starts_at, duration_min)')
        .eq('user_id', user.id)
        .gte('registered_at', month.start.toISOString())
        .lt('registered_at', month.end.toISOString()),

      // 3. User's next upcoming active registration
      supabase
        .from('club_registrations')
        .select('id, status, club:clubs!inner(id, starts_at, category, topic, duration_min, cover_emoji)')
        .eq('user_id', user.id)
        .in('status', ACTIVE_REG_STATUSES as unknown as string[])
        .gt('club.starts_at', nowIso)
        .order('club(starts_at)', { ascending: true })
        .limit(1),

      // 4. Sum of club-related XP events this month
      supabase
        .from('xp_events')
        .select('amount')
        .eq('user_id', user.id)
        .in('source_type', CLUB_XP_SOURCES as unknown as string[])
        .gte('created_at', month.start.toISOString())
        .lt('created_at', month.end.toISOString()),
    ])

    if (weekCountRes.error) {
      console.error('[clubs/stats] weekCount error:', weekCountRes.error)
    }
    if (attendedRes.error) {
      console.error('[clubs/stats] attended error:', attendedRes.error)
    }
    if (nextClubRes.error) {
      console.error('[clubs/stats] nextClub error:', nextClubRes.error)
    }
    if (xpRes.error) {
      console.error('[clubs/stats] xp error:', xpRes.error)
    }

    const weekCount = weekCountRes.count ?? 0

    // Dedupe by club_id; count a club as "attended" if the reg says so, or if
    // the club's end time has passed and the user's registration is still
    // active (registered/attended).
    const attendedIds = new Set<string>()
    for (const row of attendedRes.data ?? []) {
      const status = row.status
      const clubStart = row.club?.starts_at ? new Date(row.club.starts_at) : null
      const duration = Number(row.club?.duration_min ?? 0)
      const clubEnd = clubStart
        ? new Date(clubStart.getTime() + duration * 60_000)
        : null
      const hasEnded = clubEnd ? clubEnd <= now : false
      if (status === 'attended' || (status === 'registered' && hasEnded)) {
        if (row.club_id) attendedIds.add(row.club_id)
      }
    }
    const attendedThisMonth = attendedIds.size

    const nextRow = nextClubRes.data?.[0]
    const nextClub = nextRow?.club
      ? {
          id: nextRow.club.id,
          starts_at: nextRow.club.starts_at,
          club_type: nextRow.club.category,
          topic: nextRow.club.topic,
          duration_min: nextRow.club.duration_min,
          cover_emoji: nextRow.club.cover_emoji,
          registration_id: nextRow.id,
          registration_status: nextRow.status,
        }
      : null

    const xpThisMonth =
      (xpRes.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0) || 0

    return NextResponse.json({
      weekCount,
      attendedThisMonth,
      nextClub,
      xpThisMonth,
      // Debug window bounds for the caller to align charts if needed.
      meta: {
        week: { start: week.start.toISOString(), end: week.end.toISOString() },
        month: { start: month.start.toISOString(), end: month.end.toISOString() },
      },
    })
  } catch (error) {
    console.error('[clubs/stats] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
