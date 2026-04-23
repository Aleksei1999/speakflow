// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid({ message: 'Некорректный идентификатор группы' })

const postSchema = z.object({
  student_ids: z.array(z.string().uuid()).min(1).max(500),
})

async function resolveTeacherProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

async function assertOwnership(supabase: any, groupId: string, teacherProfileId: string) {
  const { data } = await supabase
    .from('teacher_groups')
    .select('id, teacher_id')
    .eq('id', groupId)
    .maybeSingle()
  return !!(data && data.teacher_id === teacherProfileId)
}

// ---------------------------------------------------------------
// POST /api/teacher/groups/[id]/members — batch add
// ---------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idParsed = idSchema.safeParse(id)
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const teacherProfileId = await resolveTeacherProfileId(supabase, user.id)
    if (!teacherProfileId) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 403 }
      )
    }

    if (!(await assertOwnership(supabase, id, teacherProfileId))) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ожидается JSON' }, { status: 400 })
    }
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const unique = Array.from(new Set(parsed.data.student_ids))
    const rows = unique.map((sid) => ({ group_id: id, student_id: sid }))

    const { data: inserted, error } = await supabase
      .from('teacher_group_members')
      .upsert(rows, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
      .select('student_id')
    if (error) {
      console.error('Ошибка добавления участников:', error)
      return NextResponse.json({ error: 'Не удалось добавить участников' }, { status: 500 })
    }

    return NextResponse.json({
      added: inserted?.length || 0,
      requested: unique.length,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка POST /groups/[id]/members:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// DELETE /api/teacher/groups/[id]/members?student_id=<uuid>
// ---------------------------------------------------------------
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idParsed = idSchema.safeParse(id)
    if (!idParsed.success) {
      return NextResponse.json({ error: idParsed.error.issues[0].message }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const studentIdRaw = searchParams.get('student_id') || ''
    const sidParsed = z
      .string()
      .uuid({ message: 'Некорректный идентификатор студента' })
      .safeParse(studentIdRaw)
    if (!sidParsed.success) {
      return NextResponse.json({ error: sidParsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const teacherProfileId = await resolveTeacherProfileId(supabase, user.id)
    if (!teacherProfileId) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 403 }
      )
    }

    if (!(await assertOwnership(supabase, id, teacherProfileId))) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 })
    }

    const { error, count } = await supabase
      .from('teacher_group_members')
      .delete({ count: 'exact' })
      .eq('group_id', id)
      .eq('student_id', sidParsed.data)
    if (error) {
      console.error('Ошибка удаления участника:', error)
      return NextResponse.json({ error: 'Не удалось удалить участника' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, removed: count || 0 })
  } catch (err) {
    console.error('Непредвиденная ошибка DELETE /groups/[id]/members:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
