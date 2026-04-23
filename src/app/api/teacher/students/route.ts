// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// GET /api/teacher/students — DISTINCT students by lessons.teacher_id
// ---------------------------------------------------------------
export async function GET() {
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

    const { data: lessonRows, error: lErr } = await supabase
      .from('lessons')
      .select('student_id, scheduled_at, status')
      .eq('teacher_id', tp.id)
      .order('scheduled_at', { ascending: false })
    if (lErr) {
      console.error('Ошибка чтения уроков:', lErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }

    const lastLessonByStudent: Record<string, string> = {}
    const completedCountByStudent: Record<string, number> = {}
    const studentIds = new Set<string>()
    for (const row of lessonRows || []) {
      studentIds.add(row.student_id)
      if (!lastLessonByStudent[row.student_id]) {
        lastLessonByStudent[row.student_id] = row.scheduled_at
      }
      if (row.status === 'completed') {
        completedCountByStudent[row.student_id] =
          (completedCountByStudent[row.student_id] || 0) + 1
      }
    }

    const ids = Array.from(studentIds)
    if (ids.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const [{ data: profiles }, { data: progress }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', ids),
      supabase
        .from('user_progress')
        .select('user_id, english_level, total_xp')
        .in('user_id', ids),
    ])

    const progMap: Record<string, any> = {}
    for (const p of progress || []) progMap[p.user_id] = p

    const students = (profiles || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      email: p.email,
      english_level: progMap[p.id]?.english_level || null,
      total_xp: progMap[p.id]?.total_xp || 0,
      last_lesson_at: lastLessonByStudent[p.id] || null,
      lessons_completed: completedCountByStudent[p.id] || 0,
    }))

    students.sort((a: any, b: any) =>
      (a.full_name || '').localeCompare(b.full_name || '', 'ru', { sensitivity: 'base' })
    )

    return NextResponse.json({ students })
  } catch (err) {
    console.error('Непредвиденная ошибка GET /api/teacher/students:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
