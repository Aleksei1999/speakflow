// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// Homework table schema reference
//   homework.teacher_id → profiles.id   (NOT teacher_profiles.id — legacy)
//   homework.student_id → profiles.id
//   homework.lesson_id  → lessons.id    (optional)
//   status ∈ ('pending','in_progress','submitted','reviewed','overdue')
//
// UI status mapping:
//   prototype "на проверке" = status='submitted'
//   prototype "выдано"      = status IN ('pending','in_progress')
//   prototype "просрочено"  = status='overdue' OR (status IN ('pending','in_progress') AND due_date < now())
//   prototype "проверено"   = status='reviewed'
// ---------------------------------------------------------------

const STATUS_ENUM = [
  'pending',
  'in_progress',
  'submitted',
  'reviewed',
  'overdue',
] as const

const FILTER_ENUM = [
  'all',
  'submitted',   // "на проверке"
  'assigned',    // "выдано"
  'overdue',     // "просрочено"
  'reviewed',    // "проверено"
] as const

const SORT_ENUM = ['recent', 'due_soon', 'student'] as const

const getQuerySchema = z.object({
  status: z.enum(FILTER_ENUM).default('all'),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(SORT_ENUM).default('recent'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(1000),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().trim().max(200).optional(),
})

const postSchema = z.object({
  student_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  due_date: z.string().datetime(),
  lesson_id: z.string().uuid().optional().nullable(),
  attachments: z.array(attachmentSchema).max(20).default([]),
})

// ---------------------------------------------------------------
// Derive UI-facing status given DB status + due date
// ---------------------------------------------------------------
function deriveUiStatus(row: any): 'submitted' | 'reviewed' | 'overdue' | 'assigned' {
  if (row.status === 'submitted') return 'submitted'
  if (row.status === 'reviewed') return 'reviewed'
  if (row.status === 'overdue') return 'overdue'
  // pending / in_progress — check due date
  if (row.due_date && new Date(row.due_date).getTime() < Date.now()) {
    return 'overdue'
  }
  return 'assigned'
}

function applyFilter(rows: any[], status: string): any[] {
  if (status === 'all') return rows
  return rows.filter((r) => deriveUiStatus(r) === status)
}

// ---------------------------------------------------------------
// GET /api/teacher/homework
// ---------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    // Verify teacher role
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (pErr) {
      console.error('Ошибка профиля:', pErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }
    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Доступ разрешён только преподавателям' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = getQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { status, q, sort, limit } = parsed.data

    // Load teacher's full homework list (RLS enforces teacher_id = auth.uid())
    const { data: rows, error } = await supabase
      .from('homework')
      .select(
        'id, student_id, teacher_id, lesson_id, title, description, due_date, status, submission_text, teacher_feedback, grade, score_10, submitted_at, reviewed_at, reminders_count, last_reminded_at, attachments, created_at, updated_at'
      )
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) {
      console.error('Ошибка чтения homework:', error)
      return NextResponse.json(
        { error: 'Не удалось загрузить домашние задания' },
        { status: 500 }
      )
    }

    const allRows = rows || []

    // Build facet counters (across full library, pre-search)
    const counts: Record<string, number> = {
      all: allRows.length,
      submitted: 0,
      assigned: 0,
      overdue: 0,
      reviewed: 0,
    }
    let lastSubmittedAt: string | null = null
    let avgScore: number | null = null
    let scoreSum = 0
    let scoreN = 0
    for (const r of allRows) {
      const ui = deriveUiStatus(r)
      counts[ui] += 1
      if (r.submitted_at && (!lastSubmittedAt || r.submitted_at > lastSubmittedAt)) {
        lastSubmittedAt = r.submitted_at
      }
      // Score average (prefer score_10, fall back to grade/10)
      if (typeof r.score_10 === 'number' && !Number.isNaN(r.score_10)) {
        scoreSum += Number(r.score_10)
        scoreN += 1
      } else if (typeof r.grade === 'number' && r.grade > 0) {
        scoreSum += Number(r.grade) / 10
        scoreN += 1
      }
    }
    if (scoreN > 0) avgScore = Math.round((scoreSum / scoreN) * 10) / 10

    // Apply filter tab
    let filtered = applyFilter(allRows, status)

    // Search by title / student name — title first (fast), then gather student names
    if (q && q.length > 0) {
      // We need student names for search — fetch them below, but title match first
      const needle = q.toLowerCase()
      filtered = filtered.filter((r) =>
        (r.title || '').toLowerCase().includes(needle)
      )
      // Full student-name search will be applied after we resolve names below.
    }

    // Sort
    switch (sort) {
      case 'due_soon':
        filtered.sort(
          (a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )
        break
      case 'student':
        // Will re-sort after joining student names
        break
      case 'recent':
      default:
        filtered.sort((a, b) => {
          // Submitted/overdue first, then by date desc
          const aUi = deriveUiStatus(a)
          const bUi = deriveUiStatus(b)
          const weight: Record<string, number> = {
            submitted: 0,
            overdue: 1,
            assigned: 2,
            reviewed: 3,
          }
          const w = (weight[aUi] ?? 9) - (weight[bUi] ?? 9)
          if (w !== 0) return w
          const aT = a.submitted_at || a.due_date || a.created_at
          const bT = b.submitted_at || b.due_date || b.created_at
          return new Date(bT).getTime() - new Date(aT).getTime()
        })
        break
    }

    // Trim
    const limited = filtered.slice(0, limit)

    // Resolve student profiles (name + avatar + level) in one batch
    const studentIds = Array.from(
      new Set(limited.map((r) => r.student_id).filter(Boolean))
    )
    const [{ data: sProfiles }, { data: sProgress }, { data: lessons }] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      studentIds.length > 0
        ? supabase
            .from('user_progress')
            .select('user_id, english_level')
            .in('user_id', studentIds)
        : Promise.resolve({ data: [] as any[] }),
      (() => {
        const lessonIds = Array.from(
          new Set(limited.map((r) => r.lesson_id).filter(Boolean))
        )
        if (lessonIds.length === 0) {
          return Promise.resolve({ data: [] as any[] })
        }
        return supabase
          .from('lessons')
          .select('id, scheduled_at')
          .in('id', lessonIds)
      })(),
    ])

    const profileMap: Record<string, any> = {}
    for (const p of sProfiles || []) profileMap[p.id] = p
    const progressMap: Record<string, any> = {}
    for (const p of sProgress || []) progressMap[p.user_id] = p
    const lessonMap: Record<string, any> = {}
    for (const l of lessons || []) lessonMap[l.id] = l

    let enriched = limited.map((r) => {
      const p = profileMap[r.student_id] || {}
      const pr = progressMap[r.student_id] || {}
      return {
        id: r.id,
        student_id: r.student_id,
        student_name: p.full_name || 'Ученик',
        student_avatar: p.avatar_url || null,
        student_level: pr.english_level || null,
        lesson_id: r.lesson_id,
        lesson_at: lessonMap[r.lesson_id]?.scheduled_at || null,
        title: r.title,
        description: r.description,
        due_date: r.due_date,
        status: r.status,
        ui_status: deriveUiStatus(r),
        submission_text: r.submission_text,
        teacher_feedback: r.teacher_feedback,
        grade: r.grade,
        score_10: r.score_10 !== null ? Number(r.score_10) : null,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        reminders_count: r.reminders_count || 0,
        last_reminded_at: r.last_reminded_at,
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        created_at: r.created_at,
        updated_at: r.updated_at,
      }
    })

    // Secondary filter: student-name match if q provided and title didn't match
    if (q && q.length > 0) {
      // Already filtered by title; now additionally include rows where student_name matches.
      // Re-run from the full set to catch student-name-only matches.
      const needle = q.toLowerCase()
      const byTitleIds = new Set(enriched.map((r) => r.id))
      const moreByName = applyFilter(allRows, status)
        .filter((r) => {
          if (byTitleIds.has(r.id)) return false
          const p = profileMap[r.student_id] || {}
          return (p.full_name || '').toLowerCase().includes(needle)
        })
        .map((r) => {
          const p = profileMap[r.student_id] || {}
          const pr = progressMap[r.student_id] || {}
          return {
            id: r.id,
            student_id: r.student_id,
            student_name: p.full_name || 'Ученик',
            student_avatar: p.avatar_url || null,
            student_level: pr.english_level || null,
            lesson_id: r.lesson_id,
            lesson_at: lessonMap[r.lesson_id]?.scheduled_at || null,
            title: r.title,
            description: r.description,
            due_date: r.due_date,
            status: r.status,
            ui_status: deriveUiStatus(r),
            submission_text: r.submission_text,
            teacher_feedback: r.teacher_feedback,
            grade: r.grade,
            score_10: r.score_10 !== null ? Number(r.score_10) : null,
            submitted_at: r.submitted_at,
            reviewed_at: r.reviewed_at,
            reminders_count: r.reminders_count || 0,
            last_reminded_at: r.last_reminded_at,
            attachments: Array.isArray(r.attachments) ? r.attachments : [],
            created_at: r.created_at,
            updated_at: r.updated_at,
          }
        })
      enriched = [...enriched, ...moreByName]
    }

    if (sort === 'student') {
      enriched.sort((a: any, b: any) =>
        (a.student_name || '').localeCompare(b.student_name || '', 'ru', {
          sensitivity: 'base',
        })
      )
    }

    return NextResponse.json({
      homework: enriched,
      counts,
      stats: {
        last_submitted_at: lastSubmittedAt,
        avg_score_10: avgScore,
      },
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в GET /api/teacher/homework:', err)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// POST /api/teacher/homework — create
// body: { student_id, title, description?, due_date, lesson_id?, attachments? }
// ---------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Доступ разрешён только преподавателям' },
        { status: 403 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Ожидается JSON-тело запроса' },
        { status: 400 }
      )
    }

    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }
    const { student_id, title, description, due_date, lesson_id, attachments } =
      parsed.data

    // Validate: the teacher has had at least one lesson with this student.
    // We resolve the teacher's teacher_profiles.id and check lessons.
    const { data: tp } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (tp) {
      const { data: lessonRow } = await supabase
        .from('lessons')
        .select('id')
        .eq('teacher_id', tp.id)
        .eq('student_id', student_id)
        .limit(1)
        .maybeSingle()
      if (!lessonRow) {
        return NextResponse.json(
          {
            error:
              'Можно задавать домашние задания только своим ученикам (нужен хотя бы один общий урок)',
          },
          { status: 403 }
        )
      }
    }

    // Validate: if lesson_id provided, it must be this teacher's lesson with that student
    if (lesson_id && tp) {
      const { data: lRow } = await supabase
        .from('lessons')
        .select('id, teacher_id, student_id')
        .eq('id', lesson_id)
        .maybeSingle()
      if (
        !lRow ||
        lRow.teacher_id !== tp.id ||
        lRow.student_id !== student_id
      ) {
        return NextResponse.json(
          { error: 'Указанный урок не принадлежит этому ученику' },
          { status: 403 }
        )
      }
    }

    const dueDateIso = new Date(due_date).toISOString()
    const initialStatus =
      new Date(dueDateIso).getTime() < Date.now() ? 'overdue' : 'pending'

    const { data: inserted, error: insErr } = await supabase
      .from('homework')
      .insert({
        student_id,
        teacher_id: user.id,
        lesson_id: lesson_id || null,
        title,
        description: description || null,
        due_date: dueDateIso,
        status: initialStatus,
        attachments: attachments || [],
      })
      .select(
        'id, student_id, teacher_id, lesson_id, title, description, due_date, status, attachments, created_at'
      )
      .single()

    if (insErr) {
      console.error('Ошибка создания homework:', insErr)
      return NextResponse.json(
        { error: 'Не удалось создать задание' },
        { status: 500 }
      )
    }

    return NextResponse.json({ homework: inserted }, { status: 201 })
  } catch (err) {
    console.error('Непредвиденная ошибка в POST /api/teacher/homework:', err)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
