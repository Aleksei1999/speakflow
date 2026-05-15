import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ROAST_LEVELS = [
  'Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done',
] as const

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || slug.length > 200) {
      return NextResponse.json({ error: 'Некорректный slug' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    // FIXME(types): 'courses' table missing in Database type
    type CourseRow = { id: string; is_published: boolean; price_kopecks: number; required_level: string | null }
    const { data: course, error: courseError } = (await (supabase as any)
      .from('courses')
      .select('id, is_published, price_kopecks, required_level')
      .eq('slug', slug)
      .maybeSingle()) as { data: CourseRow | null; error: any }
    if (courseError) {
      console.error('Ошибка загрузки курса:', courseError)
      return NextResponse.json({ error: 'Ошибка загрузки курса' }, { status: 500 })
    }
    if (!course || !course.is_published) {
      return NextResponse.json({ error: 'Курс не найден' }, { status: 404 })
    }

    // Level gate (optional): compare user_progress.english_level to course.required_level
    if (course.required_level) {
      const { data: progress } = (await supabase
        .from('user_progress')
        .select('english_level')
        .eq('user_id', user.id)
        .maybeSingle()) as { data: { english_level: string | null } | null }
      const needed = ROAST_LEVELS.indexOf(course.required_level as typeof ROAST_LEVELS[number])
      const have = progress?.english_level
        ? ROAST_LEVELS.indexOf(progress.english_level as typeof ROAST_LEVELS[number])
        : -1
      if (have < needed) {
        return NextResponse.json(
          { error: `Для этого курса нужен уровень «${course.required_level}»` },
          { status: 403 }
        )
      }
    }

    // FIXME(types): 'course_enrollments' table missing in Database type
    const { data: existing } = (await (supabase as any)
      .from('course_enrollments')
      .select('id, status')
      .eq('course_id', course.id)
      .eq('user_id', user.id)
      .maybeSingle()) as { data: { id: string; status: string } | null }
    if (existing) {
      return NextResponse.json(
        { error: 'Вы уже записаны на этот курс', enrollment_id: existing.id, status: existing.status },
        { status: 409 }
      )
    }

    const isFree = course.price_kopecks === 0
    const initialStatus = isFree ? 'active' : 'pending_payment'

    // FIXME(types): 'course_enrollments' table missing in Database type
    const { data: enr, error: insertError } = (await (supabase as any)
      .from('course_enrollments')
      .insert({
        course_id: course.id,
        user_id: user.id,
        status: initialStatus,
        started_at: isFree ? new Date().toISOString() : null,
      })
      .select('id, status, started_at')
      .single()) as { data: { id: string; status: string; started_at: string | null } | null; error: any }
    if (insertError) {
      console.error('Ошибка создания записи на курс:', insertError)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Вы уже записаны на этот курс' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Не удалось записаться на курс' }, { status: 500 })
    }

    return NextResponse.json({
      enrollment_id: enr!.id,
      status: enr!.status,
      is_free: isFree,
      payment_url: null, // YooKassa ещё не подключена
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/courses/[slug]/enroll:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
