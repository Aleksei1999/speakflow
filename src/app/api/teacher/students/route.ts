// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// GET /api/teacher/students
//   Aggregates teacher's students from `lessons` where teacher_id
//   = teacher_profiles.id of the logged-in user.
//
//   Query params:
//     level = A1|A2|B1|B2|C1|C2|all   (default: all)
//     q     = search string (name or email, case-insensitive)
// ---------------------------------------------------------------

const LEVEL_ENUM = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const querySchema = z.object({
  level: z.enum(LEVEL_ENUM).default('all'),
  q: z.string().trim().max(200).optional(),
})

// Which lesson statuses count as "upcoming / booked"
const UPCOMING_STATUSES = new Set(['scheduled', 'confirmed', 'booked'])

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data: tp, error: tpErr } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (tpErr || !tp) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      level: searchParams.get('level') ?? undefined,
      q: searchParams.get('q') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { level: levelFilter, q } = parsed.data

    // Pull all lessons belonging to this teacher in a single query.
    const { data: lessonRows, error: lErr } = await supabase
      .from('lessons')
      .select(
        'id, student_id, scheduled_at, status, duration_minutes, teacher_notes'
      )
      .eq('teacher_id', tp.id)
      .order('scheduled_at', { ascending: false })
    if (lErr) {
      console.error('Ошибка чтения уроков:', lErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }

    const allLessons = lessonRows || []
    const now = Date.now()
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

    // Aggregate per-student helpers
    const studentIds = new Set<string>()
    const lastLessonByStudent: Record<string, string> = {} // most recent (any status)
    const completedCountByStudent: Record<string, number> = {}
    const lastAnyLessonTsByStudent: Record<string, number> = {}
    // For "next lesson" we keep the earliest upcoming (future, booked/confirmed/scheduled)
    const nextLessonByStudent: Record<
      string,
      { scheduled_at: string; id: string; notes: string | null }
    > = {}

    for (const row of allLessons) {
      const sid = row.student_id
      if (!sid) continue
      studentIds.add(sid)

      // Track last lesson overall (ordered desc already)
      if (!lastLessonByStudent[sid]) {
        lastLessonByStudent[sid] = row.scheduled_at
      }
      const ts = new Date(row.scheduled_at).getTime()
      if (!Number.isNaN(ts)) {
        if (
          !lastAnyLessonTsByStudent[sid] ||
          ts > lastAnyLessonTsByStudent[sid]
        ) {
          lastAnyLessonTsByStudent[sid] = ts
        }
      }

      if (row.status === 'completed') {
        completedCountByStudent[sid] = (completedCountByStudent[sid] || 0) + 1
      }

      if (UPCOMING_STATUSES.has(row.status) && !Number.isNaN(ts) && ts > now) {
        const cur = nextLessonByStudent[sid]
        if (!cur || ts < new Date(cur.scheduled_at).getTime()) {
          nextLessonByStudent[sid] = {
            scheduled_at: row.scheduled_at,
            id: row.id,
            notes: row.teacher_notes ?? null,
          }
        }
      }
    }

    const ids = Array.from(studentIds)
    if (ids.length === 0) {
      return NextResponse.json({
        students: [],
        counts: { all: 0, A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
        stats: {
          total: 0,
          active_today: 0,
          avg_progress: 0,
          needs_attention: 0,
        },
      })
    }

    const [{ data: profiles }, { data: progress }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', ids),
      supabase
        .from('user_progress')
        .select('user_id, english_level, total_xp, current_streak, lessons_completed')
        .in('user_id', ids),
    ])

    const progMap: Record<string, any> = {}
    for (const p of progress || []) progMap[p.user_id] = p

    // Build enriched records
    const all = (profiles || []).map((p: any) => {
      const pr = progMap[p.id] || {}
      const completed = pr.lessons_completed ?? completedCountByStudent[p.id] ?? 0
      const current_streak = pr.current_streak ?? 0
      const nextLesson = nextLessonByStudent[p.id] || null
      const lastLessonTs = lastAnyLessonTsByStudent[p.id] || 0
      const noLessonsRecent = lastLessonTs === 0 || lastLessonTs < fourteenDaysAgo
      const needs_attention = current_streak === 0 || noLessonsRecent

      // Course progress: 20 completed lessons = 100%
      const course_progress_pct = Math.min(
        100,
        Math.round((completed || 0) / 0.2)
      )

      // Extract topic from teacher_notes (first non-empty line) or fallback
      let next_lesson_topic = 'Урок'
      if (nextLesson?.notes) {
        const firstLine = String(nextLesson.notes)
          .split('\n')
          .map((s) => s.trim())
          .find((s) => s.length > 0)
        if (firstLine) next_lesson_topic = firstLine.slice(0, 80)
      }

      return {
        id: p.id,
        full_name: p.full_name || 'Ученик',
        avatar_url: p.avatar_url || null,
        email: p.email || null,
        english_level: pr.english_level || null,
        total_xp: pr.total_xp || 0,
        current_streak,
        lessons_completed: completed,
        last_lesson_at: lastLessonByStudent[p.id] || null,
        next_lesson_id: nextLesson?.id || null,
        next_lesson_at: nextLesson?.scheduled_at || null,
        next_lesson_topic,
        course_progress_pct,
        needs_attention,
      }
    })

    // Facet counts BEFORE applying level/q filter
    const counts: Record<string, number> = {
      all: all.length,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    }
    for (const s of all) {
      if (s.english_level && counts[s.english_level] !== undefined) {
        counts[s.english_level] += 1
      }
    }

    // Apply filters
    let filtered = all
    if (levelFilter !== 'all') {
      filtered = filtered.filter((s) => s.english_level === levelFilter)
    }
    if (q && q.length > 0) {
      const needle = q.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          (s.full_name || '').toLowerCase().includes(needle) ||
          (s.email || '').toLowerCase().includes(needle)
      )
    }

    // Sort: students with a lesson today first, then by next_lesson_at asc,
    // then by last_lesson_at desc.
    const nowDate = new Date()
    filtered.sort((a: any, b: any) => {
      const aNext = a.next_lesson_at ? new Date(a.next_lesson_at) : null
      const bNext = b.next_lesson_at ? new Date(b.next_lesson_at) : null
      const aToday = aNext ? isSameCalendarDay(aNext, nowDate) : false
      const bToday = bNext ? isSameCalendarDay(bNext, nowDate) : false
      if (aToday !== bToday) return aToday ? -1 : 1
      if (aNext && bNext) return aNext.getTime() - bNext.getTime()
      if (aNext) return -1
      if (bNext) return 1
      const aLast = a.last_lesson_at ? new Date(a.last_lesson_at).getTime() : 0
      const bLast = b.last_lesson_at ? new Date(b.last_lesson_at).getTime() : 0
      return bLast - aLast
    })

    // Stats across ALL students (not just the filtered slice)
    const total = all.length
    let activeToday = 0
    let needsAttention = 0
    let progressSum = 0
    for (const s of all) {
      if (s.next_lesson_at && isSameCalendarDay(new Date(s.next_lesson_at), nowDate)) {
        activeToday += 1
      }
      if (s.needs_attention) needsAttention += 1
      progressSum += s.course_progress_pct || 0
    }
    const avgProgress = total > 0 ? Math.round(progressSum / total) : 0

    return NextResponse.json({
      students: filtered,
      counts,
      stats: {
        total,
        active_today: activeToday,
        avg_progress: avgProgress,
        needs_attention: needsAttention,
      },
    })
  } catch (err) {
    console.error('Непредвиденная ошибка GET /api/teacher/students:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
