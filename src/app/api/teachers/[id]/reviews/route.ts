// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

function buildInitials(fullName?: string | null): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (parts.length === 0) return ''
  return parts.map((p) => p.charAt(0).toUpperCase()).join('')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teacherProfileId } = await params

    if (!UUID_REGEX.test(teacherProfileId)) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { limit } = parsed.data

    // Verify teacher exists / is listed before returning reviews.
    const { data: teacher, error: teacherErr } = await supabase
      .from('teacher_profiles')
      .select('id, is_listed')
      .eq('id', teacherProfileId)
      .maybeSingle()

    if (teacherErr) {
      console.error('Ошибка загрузки преподавателя:', teacherErr)
      return NextResponse.json({ reviews: [] })
    }
    if (!teacher || !teacher.is_listed) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from('reviews')
      .select(
        `
          id,
          rating,
          comment,
          created_at,
          profiles:student_id (
            full_name,
            avatar_url
          )
        `
      )
      .eq('teacher_id', teacherProfileId)
      .eq('is_visible', true)
      .gte('rating', 1)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 50))

    if (error) {
      // Permission / schema failure — degrade gracefully per spec.
      console.error('Ошибка загрузки отзывов:', error)
      return NextResponse.json({ reviews: [] })
    }

    const reviews = (data || [])
      .map((row: Record<string, unknown>) => {
        const comment = (row.comment as string | null) ?? ''
        if (!comment || comment.trim().length === 0) return null
        const profile = row.profiles as Record<string, unknown> | null
        const fullName = (profile?.full_name as string) || 'Студент'
        return {
          id: row.id as string,
          rating: row.rating as number,
          comment,
          created_at: row.created_at as string,
          student: {
            full_name: fullName,
            initials: buildInitials(fullName),
            avatar_url: (profile?.avatar_url as string | null) ?? null,
          },
        }
      })
      .filter(Boolean)

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/teachers/[id]/reviews:', error)
    return NextResponse.json({ reviews: [] })
  }
}

const postSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teacherProfileId } = await params
    if (!UUID_REGEX.test(teacherProfileId)) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    // Ищем последний completed урок этого ученика с этим преподом,
    // на который ещё нет отзыва.
    const { data: candidates, error: lessonsErr } = await supabase
      .from('lessons')
      .select('id, scheduled_at')
      .eq('teacher_id', teacherProfileId)
      .eq('student_id', user.id)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false })
    if (lessonsErr) {
      console.error('[reviews POST] lessons select failed', lessonsErr)
      return NextResponse.json({ error: 'Ошибка БД' }, { status: 500 })
    }
    const ids = (candidates ?? []).map((l: any) => l.id)
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Оставить отзыв можно только после проведённого урока' },
        { status: 403 }
      )
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('lesson_id')
      .in('lesson_id', ids)
    const reviewedSet = new Set(((existing ?? []) as any[]).map((r) => r.lesson_id))
    const targetLesson = ids.find((id: string) => !reviewedSet.has(id))
    if (!targetLesson) {
      return NextResponse.json(
        { error: 'Вы уже оставили отзыв на все проведённые уроки с этим преподавателем' },
        { status: 409 }
      )
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        lesson_id: targetLesson,
        student_id: user.id,
        teacher_id: teacherProfileId,
        rating: parsed.data.rating,
        comment: parsed.data.comment?.trim() || null,
      })
      .select('id, rating, comment, created_at')
      .single()

    if (insertErr) {
      console.error('[reviews POST] insert failed', insertErr)
      const code = (insertErr as any)?.code
      if (code === '23505') {
        return NextResponse.json({ error: 'Отзыв уже оставлен' }, { status: 409 })
      }
      return NextResponse.json(
        { error: insertErr.message || 'Не удалось сохранить отзыв' },
        { status: 500 }
      )
    }

    return NextResponse.json({ review: inserted })
  } catch (error) {
    console.error('Непредвиденная ошибка POST /api/teachers/[id]/reviews:', error)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
