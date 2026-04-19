// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { coursesListQuerySchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = coursesListQuerySchema.safeParse({
      goal: searchParams.get('goal') ?? undefined,
      level: searchParams.get('level') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { goal, level, limit } = parsed.data

    const supabase = await createClient()

    let query = supabase
      .from('courses')
      .select(
        `
          id, slug, title, description, level, goal_tag,
          duration_hours, lesson_count, author_id,
          cover_variant, cover_word, price_kopecks, xp_reward,
          required_level, released_at,
          author:profiles!courses_author_id_fkey ( id, full_name, avatar_url )
        `
      )
      .eq('is_published', true)
      .order('released_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (goal) query = query.eq('goal_tag', goal)
    if (level) query = query.eq('level', level)

    const { data: courses, error } = await query
    if (error) {
      console.error('Ошибка загрузки курсов:', error)
      return NextResponse.json({ error: 'Не удалось загрузить курсы' }, { status: 500 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let myEnrollments: Record<string, string> = {}
    if (user && (courses?.length ?? 0) > 0) {
      const ids = courses!.map((c) => c.id)
      const { data: enrolls } = await supabase
        .from('course_enrollments')
        .select('course_id, status')
        .eq('user_id', user.id)
        .in('course_id', ids)
      if (enrolls) {
        myEnrollments = Object.fromEntries(enrolls.map((e) => [e.course_id, e.status]))
      }
    }

    const result = (courses ?? []).map((c) => ({
      ...c,
      my_enrollment_status: myEnrollments[c.id] ?? null,
    }))

    return NextResponse.json({ courses: result })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/courses:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
