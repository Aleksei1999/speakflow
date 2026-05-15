import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  status: z
    .enum(['pending_payment', 'active', 'completed', 'refunded', 'revoked'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { status, limit } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    // FIXME(types): 'course_enrollments' / 'courses' tables missing in Database type
    type EnrollmentRow = {
      id: string; status: string; started_at: string | null; completed_at: string | null
      current_lesson_id: string | null; created_at: string
      course: { id: string; slug: string; title: string; description: string | null; level: string | null; goal_tag: string | null; duration_hours: number | null; lesson_count: number | null; cover_variant: string | null; cover_word: string | null; price_kopecks: number | null; xp_reward: number | null } | null
    }
    let query: any = (supabase as any)
      .from('course_enrollments')
      .select(
        `
          id, status, started_at, completed_at, current_lesson_id, created_at,
          course:courses!inner (
            id, slug, title, description, level, goal_tag,
            duration_hours, lesson_count, cover_variant, cover_word,
            price_kopecks, xp_reward
          )
        `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data: enrollments, error } = (await query) as { data: EnrollmentRow[] | null; error: any }
    if (error) {
      console.error('Ошибка загрузки записей на курсы:', error)
      return NextResponse.json({ error: 'Не удалось загрузить курсы' }, { status: 500 })
    }

    const courseIds = (enrollments ?? [])
      .filter((e) => e.course && ['active', 'completed'].includes(e.status))
      .map((e) => e.course!.id)

    let progressByCourse: Record<string, number> = {}
    if (courseIds.length > 0) {
      // FIXME(types): 'course_lesson_progress' table missing in Database type
      const { data: progress } = (await (supabase as any)
        .from('course_lesson_progress')
        .select('course_id')
        .eq('user_id', user.id)
        .in('course_id', courseIds)) as { data: Array<{ course_id: string }> | null }
      for (const row of progress ?? []) {
        progressByCourse[row.course_id] = (progressByCourse[row.course_id] ?? 0) + 1
      }
    }

    const result = (enrollments ?? []).map((e) => ({
      ...e,
      lessons_completed: e.course ? progressByCourse[e.course.id] ?? 0 : 0,
    }))

    return NextResponse.json({ enrollments: result })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/courses/mine:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
