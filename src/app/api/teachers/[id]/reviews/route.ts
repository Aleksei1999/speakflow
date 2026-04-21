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
