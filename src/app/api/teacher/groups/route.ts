// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const postSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  student_ids: z.array(z.string().uuid()).max(500).optional(),
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
// GET /api/teacher/groups — list of teacher's groups + member_count
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

    const teacherProfileId = await resolveTeacherProfileId(supabase, user.id)
    if (!teacherProfileId) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 403 }
      )
    }

    const { data: groups, error } = await supabase
      .from('teacher_groups')
      .select('id, name, description, created_at, updated_at')
      .eq('teacher_id', teacherProfileId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Ошибка загрузки групп:', error)
      return NextResponse.json({ error: 'Не удалось загрузить группы' }, { status: 500 })
    }

    const ids = (groups || []).map((g: any) => g.id)
    const countsMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: members, error: mErr } = await supabase
        .from('teacher_group_members')
        .select('group_id')
        .in('group_id', ids)
      if (mErr) {
        console.error('Ошибка подсчёта участников группы:', mErr)
      } else {
        for (const m of members || []) {
          countsMap[m.group_id] = (countsMap[m.group_id] || 0) + 1
        }
      }
    }

    const payload = (groups || []).map((g: any) => ({
      ...g,
      member_count: countsMap[g.id] || 0,
    }))

    return NextResponse.json({ groups: payload })
  } catch (err) {
    console.error('Непредвиденная ошибка GET /api/teacher/groups:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// POST /api/teacher/groups — create group, optionally seed members
// ---------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
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

    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }
    const { name, description, student_ids } = parsed.data

    const { data: inserted, error: insErr } = await supabase
      .from('teacher_groups')
      .insert({
        teacher_id: teacherProfileId,
        name,
        description: description || null,
      })
      .select('id, name, description, created_at, updated_at')
      .single()
    if (insErr || !inserted) {
      console.error('Ошибка создания группы:', insErr)
      return NextResponse.json(
        { error: 'Не удалось создать группу' },
        { status: 500 }
      )
    }

    let member_count = 0
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const unique = Array.from(new Set(student_ids))
      const rows = unique.map((sid) => ({ group_id: inserted.id, student_id: sid }))
      const { error: memErr } = await supabase
        .from('teacher_group_members')
        .insert(rows)
      if (memErr) {
        console.error('Ошибка добавления участников:', memErr)
        // Group still exists; return it with the actual member count (0)
      } else {
        member_count = unique.length
      }
    }

    return NextResponse.json(
      { ...inserted, member_count },
      { status: 201 }
    )
  } catch (err) {
    console.error('Непредвиденная ошибка POST /api/teacher/groups:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
