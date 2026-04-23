// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid({ message: 'Некорректный идентификатор группы' })

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Нет полей для обновления',
  })

async function resolveTeacherProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

// ---------------------------------------------------------------
// GET /api/teacher/groups/[id] — detail + members
// ---------------------------------------------------------------
export async function GET(
  _request: NextRequest,
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

    const { data: group, error: gErr } = await supabase
      .from('teacher_groups')
      .select('id, teacher_id, name, description, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    if (gErr) {
      console.error('Ошибка чтения группы:', gErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }
    if (!group || group.teacher_id !== teacherProfileId) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 })
    }

    const { data: members, error: mErr } = await supabase
      .from('teacher_group_members')
      .select('student_id, added_at')
      .eq('group_id', id)
      .order('added_at', { ascending: false })
    if (mErr) {
      console.error('Ошибка чтения участников:', mErr)
      return NextResponse.json({ error: 'Не удалось загрузить участников' }, { status: 500 })
    }

    const studentIds = (members || []).map((m: any) => m.student_id)
    let profiles: any[] = []
    let progressMap: Record<string, any> = {}
    if (studentIds.length > 0) {
      const [{ data: profs }, { data: progress }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', studentIds),
        supabase
          .from('user_progress')
          .select('user_id, english_level, total_xp')
          .in('user_id', studentIds),
      ])
      profiles = profs || []
      for (const p of progress || []) {
        progressMap[p.user_id] = p
      }
    }

    const profileMap: Record<string, any> = {}
    for (const p of profiles) profileMap[p.id] = p

    const enrichedMembers = (members || []).map((m: any) => ({
      student_id: m.student_id,
      added_at: m.added_at,
      full_name: profileMap[m.student_id]?.full_name || null,
      avatar_url: profileMap[m.student_id]?.avatar_url || null,
      english_level: progressMap[m.student_id]?.english_level || null,
      total_xp: progressMap[m.student_id]?.total_xp || 0,
    }))

    return NextResponse.json({
      id: group.id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      updated_at: group.updated_at,
      member_count: enrichedMembers.length,
      members: enrichedMembers,
    })
  } catch (err) {
    console.error('Непредвиденная ошибка GET /api/teacher/groups/[id]:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// PATCH /api/teacher/groups/[id]
// ---------------------------------------------------------------
export async function PATCH(
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ожидается JSON' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { data: updated, error } = await supabase
      .from('teacher_groups')
      .update(parsed.data)
      .eq('id', id)
      .eq('teacher_id', teacherProfileId)
      .select('id, name, description, created_at, updated_at')
      .single()
    if (error) {
      console.error('Ошибка обновления группы:', error)
      return NextResponse.json({ error: 'Не удалось обновить группу' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Непредвиденная ошибка PATCH /api/teacher/groups/[id]:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// DELETE /api/teacher/groups/[id]
// ---------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
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

    const { error, count } = await supabase
      .from('teacher_groups')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('teacher_id', teacherProfileId)
    if (error) {
      console.error('Ошибка удаления группы:', error)
      return NextResponse.json({ error: 'Не удалось удалить группу' }, { status: 500 })
    }
    if (!count) {
      return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Непредвиденная ошибка DELETE /api/teacher/groups/[id]:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
