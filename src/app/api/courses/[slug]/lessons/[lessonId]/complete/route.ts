// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  time_spent_sec: z.number().int().min(0).max(24 * 3600).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; lessonId: string }> }
) {
  try {
    const { slug, lessonId } = await params
    if (!slug || !lessonId) {
      return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 })
    }
    const uuidParse = z.string().uuid().safeParse(lessonId)
    if (!uuidParse.success) {
      return NextResponse.json({ error: 'Некорректный ID урока' }, { status: 400 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }
    const { time_spent_sec } = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходимо авторизоваться' }, { status: 401 })
    }

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, lesson_count, xp_reward')
      .eq('slug', slug)
      .maybeSingle()
    if (courseError) {
      console.error('Ошибка загрузки курса:', courseError)
      return NextResponse.json({ error: 'Ошибка загрузки курса' }, { status: 500 })
    }
    if (!course) {
      return NextResponse.json({ error: 'Курс не найден' }, { status: 404 })
    }

    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id, status')
      .eq('course_id', course.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!enrollment || !['active', 'completed'].includes(enrollment.status)) {
      return NextResponse.json(
        { error: 'Нет доступа к урокам этого курса' },
        { status: 403 }
      )
    }

    const { data: lesson, error: lessonError } = await supabase
      .from('course_lessons')
      .select('id, course_id, xp_reward')
      .eq('id', lessonId)
      .eq('course_id', course.id)
      .maybeSingle()
    if (lessonError) {
      console.error('Ошибка загрузки урока:', lessonError)
      return NextResponse.json({ error: 'Ошибка загрузки урока' }, { status: 500 })
    }
    if (!lesson) {
      return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })
    }

    // Идемпотентный upsert прогресса
    const { data: existing } = await supabase
      .from('course_lesson_progress')
      .select('course_lesson_id')
      .eq('user_id', user.id)
      .eq('course_lesson_id', lesson.id)
      .maybeSingle()
    const alreadyCompleted = !!existing

    if (!alreadyCompleted) {
      const { error: progressError } = await supabase
        .from('course_lesson_progress')
        .insert({
          user_id: user.id,
          course_lesson_id: lesson.id,
          course_id: course.id,
          time_spent_sec: time_spent_sec ?? null,
        })
      if (progressError) {
        console.error('Ошибка сохранения прогресса:', progressError)
        return NextResponse.json({ error: 'Не удалось сохранить прогресс' }, { status: 500 })
      }

      if (lesson.xp_reward > 0) {
        await supabase.from('xp_events').insert({
          user_id: user.id,
          amount: lesson.xp_reward,
          source_type: 'course_lesson_completed',
          source_id: lesson.id,
        })
      }
    }

    // Полный прогресс → отмечаем курс как пройденный и выдаём бонусный XP
    const { count: completedCount } = await supabase
      .from('course_lesson_progress')
      .select('course_lesson_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('course_id', course.id)

    let courseCompleted = false
    if ((completedCount ?? 0) >= course.lesson_count && course.lesson_count > 0) {
      if (enrollment.status !== 'completed') {
        await supabase
          .from('course_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id)

        if (course.xp_reward > 0) {
          await supabase.from('xp_events').insert({
            user_id: user.id,
            amount: course.xp_reward,
            source_type: 'course_completed',
            source_id: course.id,
          })
        }
        courseCompleted = true
      }
    }

    return NextResponse.json({
      lesson_id: lesson.id,
      already_completed: alreadyCompleted,
      xp_awarded: alreadyCompleted ? 0 : lesson.xp_reward,
      lessons_completed: completedCount ?? 0,
      total_lessons: course.lesson_count,
      course_completed: courseCompleted,
      course_xp_awarded: courseCompleted ? course.xp_reward : 0,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/courses/[slug]/lessons/[lessonId]/complete:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
