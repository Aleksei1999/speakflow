// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid({ message: 'Некорректный идентификатор материала' })

const postSchema = z
  .object({
    students: z.array(z.string().uuid()).max(500).optional(),
    homeworks: z.array(z.string().uuid()).max(500).optional(),
    groups: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine(
    (obj) =>
      (obj.students?.length || 0) +
        (obj.homeworks?.length || 0) +
        (obj.groups?.length || 0) >
      0,
    { message: 'Нужно передать хотя бы одну цель' }
  )

const deleteSchema = z.object({
  share_ids: z.array(z.string().uuid()).min(1).max(500),
})

async function resolveTeacherProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

async function assertMaterialOwnership(
  supabase: any,
  materialId: string,
  teacherProfileId: string
) {
  const { data } = await supabase
    .from('materials')
    .select('id, teacher_id')
    .eq('id', materialId)
    .maybeSingle()
  return !!(data && data.teacher_id === teacherProfileId)
}

async function expandShares(supabase: any, materialId: string) {
  const { data: shares, error } = await supabase
    .from('material_shares')
    .select('id, target_type, target_id, created_at')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })
  if (error || !shares) return { shares: [], error }

  const studentIds = shares.filter((s: any) => s.target_type === 'student').map((s: any) => s.target_id)
  const hwIds = shares.filter((s: any) => s.target_type === 'homework').map((s: any) => s.target_id)
  const groupIds = shares.filter((s: any) => s.target_type === 'group').map((s: any) => s.target_id)

  const [studRes, hwRes, grpRes] = await Promise.all([
    studentIds.length
      ? supabase.from('profiles').select('id, full_name, avatar_url').in('id', studentIds)
      : Promise.resolve({ data: [] }),
    hwIds.length
      ? supabase.from('homework').select('id, title, student_id, due_date').in('id', hwIds)
      : Promise.resolve({ data: [] }),
    groupIds.length
      ? supabase.from('teacher_groups').select('id, name').in('id', groupIds)
      : Promise.resolve({ data: [] }),
  ])

  const profMap: Record<string, any> = {}
  for (const p of studRes.data || []) profMap[p.id] = p
  const hwMap: Record<string, any> = {}
  for (const h of hwRes.data || []) hwMap[h.id] = h
  const grpMap: Record<string, any> = {}
  for (const g of grpRes.data || []) grpMap[g.id] = g

  const enriched = shares.map((s: any) => {
    let label = ''
    let meta: Record<string, any> = {}
    if (s.target_type === 'student') {
      label = profMap[s.target_id]?.full_name || 'Ученик'
      meta = { avatar_url: profMap[s.target_id]?.avatar_url || null }
    } else if (s.target_type === 'homework') {
      label = hwMap[s.target_id]?.title || 'Домашнее задание'
      meta = { due_date: hwMap[s.target_id]?.due_date || null }
    } else if (s.target_type === 'group') {
      label = grpMap[s.target_id]?.name || 'Группа'
    }
    return { ...s, label, meta }
  })

  return { shares: enriched, error: null }
}

// ---------------------------------------------------------------
// GET /api/teacher/materials/[id]/share
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

    if (!(await assertMaterialOwnership(supabase, id, teacherProfileId))) {
      return NextResponse.json({ error: 'Материал не найден' }, { status: 404 })
    }

    const { shares, error } = await expandShares(supabase, id)
    if (error) {
      console.error('Ошибка загрузки shares:', error)
      return NextResponse.json({ error: 'Не удалось загрузить доступы' }, { status: 500 })
    }

    return NextResponse.json({ shares })
  } catch (err) {
    console.error('Непредвиденная ошибка GET share:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// POST /api/teacher/materials/[id]/share
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

    if (!(await assertMaterialOwnership(supabase, id, teacherProfileId))) {
      return NextResponse.json({ error: 'Материал не найден' }, { status: 404 })
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
    const { students = [], homeworks = [], groups = [] } = parsed.data

    // Validate that homeworks/groups belong to this teacher (students are
    // validated implicitly by RLS + uniqueness; sharing to a non-student
    // user is harmless because that user still won't satisfy the recipient
    // branches of the RLS check).
    if (groups.length > 0) {
      const { data: ownGroups } = await supabase
        .from('teacher_groups')
        .select('id')
        .eq('teacher_id', teacherProfileId)
        .in('id', groups)
      const ownedSet = new Set((ownGroups || []).map((g: any) => g.id))
      const bad = groups.filter((g) => !ownedSet.has(g))
      if (bad.length > 0) {
        return NextResponse.json(
          { error: 'Одна или несколько групп не принадлежат преподавателю' },
          { status: 403 }
        )
      }
    }

    if (homeworks.length > 0) {
      // homework.teacher_id references profiles(id) == auth.uid()
      const { data: ownHw } = await supabase
        .from('homework')
        .select('id')
        .eq('teacher_id', user.id)
        .in('id', homeworks)
      const ownedSet = new Set((ownHw || []).map((h: any) => h.id))
      const bad = homeworks.filter((h) => !ownedSet.has(h))
      if (bad.length > 0) {
        return NextResponse.json(
          { error: 'Одна или несколько домашек не принадлежат преподавателю' },
          { status: 403 }
        )
      }
    }

    const rows: Array<{ material_id: string; target_type: string; target_id: string }> = [
      ...Array.from(new Set(students)).map((sid) => ({
        material_id: id,
        target_type: 'student',
        target_id: sid,
      })),
      ...Array.from(new Set(homeworks)).map((hid) => ({
        material_id: id,
        target_type: 'homework',
        target_id: hid,
      })),
      ...Array.from(new Set(groups)).map((gid) => ({
        material_id: id,
        target_type: 'group',
        target_id: gid,
      })),
    ]

    const { data: insertedRows, error: insErr } = await supabase
      .from('material_shares')
      .upsert(rows, {
        onConflict: 'material_id,target_type,target_id',
        ignoreDuplicates: true,
      })
      .select('id')
    if (insErr) {
      console.error('Ошибка вставки material_shares:', insErr)
      return NextResponse.json(
        { error: 'Не удалось поделиться материалом' },
        { status: 500 }
      )
    }

    const { shares } = await expandShares(supabase, id)

    return NextResponse.json(
      {
        inserted: insertedRows?.length || 0,
        requested: rows.length,
        shares,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Непредвиденная ошибка POST share:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// DELETE /api/teacher/materials/[id]/share  { share_ids: uuid[] }
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

    if (!(await assertMaterialOwnership(supabase, id, teacherProfileId))) {
      return NextResponse.json({ error: 'Материал не найден' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ожидается JSON' }, { status: 400 })
    }
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { error, count } = await supabase
      .from('material_shares')
      .delete({ count: 'exact' })
      .in('id', parsed.data.share_ids)
      .eq('material_id', id)
    if (error) {
      console.error('Ошибка удаления shares:', error)
      return NextResponse.json(
        { error: 'Не удалось удалить доступы' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, removed: count || 0 })
  } catch (err) {
    console.error('Непредвиденная ошибка DELETE share:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
