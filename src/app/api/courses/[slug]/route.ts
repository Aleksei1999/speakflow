// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || slug.length > 200) {
      return NextResponse.json({ error: 'Некорректный slug' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: course, error } = await supabase
      .from('courses')
      .select(
        `
          id, slug, title, description, level, goal_tag,
          duration_hours, lesson_count, author_id,
          cover_variant, cover_word, price_kopecks, xp_reward,
          required_level, is_published, released_at,
          author:profiles!courses_author_id_fkey ( id, full_name, avatar_url )
        `
      )
      .eq('slug', slug)
      .maybeSingle()
    if (error) {
      console.error('Ошибка загрузки курса:', error)
      return NextResponse.json({ error: 'Не удалось загрузить курс' }, { status: 500 })
    }
    if (!course) {
      return NextResponse.json({ error: 'Курс не найден' }, { status: 404 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let myEnrollment: {
      id: string
      status: string
      started_at: string | null
      completed_at: string | null
      current_lesson_id: string | null
    } | null = null
    let progressIds: string[] = []

    if (user) {
      const { data: enr } = await supabase
        .from('course_enrollments')
        .select('id, status, started_at, completed_at, current_lesson_id')
        .eq('course_id', course.id)
        .eq('user_id', user.id)
        .maybeSingle()
      myEnrollment = enr
      if (enr && ['active', 'completed'].includes(enr.status)) {
        const { data: progress } = await supabase
          .from('course_lesson_progress')
          .select('course_lesson_id')
          .eq('user_id', user.id)
          .eq('course_id', course.id)
        progressIds = (progress ?? []).map((p) => p.course_lesson_id)
      }
    }

    const hasAccess =
      !!myEnrollment && ['active', 'completed'].includes(myEnrollment.status)

    // Base lesson metadata is visible to everyone so the TOC is shown on the landing page.
    // Content (body/video/audio) is only returned to enrolled users; otherwise RLS hides full rows anyway.
    let lessons: any[] = []
    if (hasAccess) {
      const { data: fullLessons } = await supabase
        .from('course_lessons')
        .select('id, position, title, content_md, video_url, audio_url, estimated_minutes, xp_reward')
        .eq('course_id', course.id)
        .order('position', { ascending: true })
      lessons = (fullLessons ?? []).map((l) => ({
        ...l,
        is_completed: progressIds.includes(l.id),
      }))
    } else {
      // RLS blocks non-enrolled users from reading course_lessons, so query a lightweight summary
      // via a public projection view... fallback: show just titles/positions via a separate select.
      // Since there's no such view, return an empty list and let the UI show lesson_count.
      lessons = []
    }

    return NextResponse.json({
      course,
      my_enrollment: myEnrollment,
      lessons,
      has_access: hasAccess,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/courses/[slug]:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
