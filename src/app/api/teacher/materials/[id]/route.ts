// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  invalidateTeacherMaterials,
  invalidateStudentMaterials,
} from '@/lib/cache/invalidate'

const BUCKET = 'teacher-materials'

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    level: z.enum(['A1-A2', 'B1', 'B2', 'C1+']).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    is_public: z.boolean().optional(),
    lesson_id: z.string().uuid().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Нет полей для обновления',
  })

const idSchema = z.string().uuid({ message: 'Некорректный идентификатор' })

async function resolveTeacherProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Invalidate cached materials lists for every student who could see this
 * material (shares + lesson participants). Best-effort; never throws.
 */
async function invalidateAffectedStudents(supabase: any, materialId: string, lessonId: string | null) {
  try {
    const tasks: Array<Promise<any>> = []
    tasks.push(
      supabase
        .from('material_shares')
        .select('target_type, target_id')
        .eq('material_id', materialId)
    )
    if (lessonId) {
      tasks.push(
        supabase
          .from('lessons')
          .select('student_id')
          .eq('id', lessonId)
          .maybeSingle()
      )
    }
    const [sharesRes, lessonRes] = await Promise.all(tasks)
    const userIds = new Set<string>()
    for (const s of sharesRes?.data ?? []) {
      if (s.target_type === 'student' && s.target_id) {
        userIds.add(s.target_id)
      } else if (s.target_type === 'homework' && s.target_id) {
        const { data: hw } = await supabase
          .from('homework')
          .select('student_id')
          .eq('id', s.target_id)
          .maybeSingle()
        if (hw?.student_id) userIds.add(hw.student_id)
      } else if (s.target_type === 'group' && s.target_id) {
        const { data: members } = await supabase
          .from('teacher_group_members')
          .select('member_id')
          .eq('group_id', s.target_id)
        for (const m of members ?? []) {
          if (m.member_id) userIds.add(m.member_id)
        }
      }
    }
    if (lessonRes && 'data' in lessonRes && lessonRes.data?.student_id) {
      userIds.add(lessonRes.data.student_id)
    }
    for (const uid of userIds) invalidateStudentMaterials(uid)
  } catch (err) {
    console.error('[material-invalidate] failed', err)
  }
}

// ---------------------------------------------------------------
// DELETE /api/teacher/materials/[id]
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

    // Fetch material + verify ownership
    const { data: material, error: fetchErr } = await supabase
      .from('materials')
      .select('id, teacher_id, storage_path, lesson_id')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) {
      console.error('Ошибка чтения материала:', fetchErr)
      return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
    }
    if (!material || material.teacher_id !== teacherProfileId) {
      return NextResponse.json({ error: 'Материал не найден' }, { status: 404 })
    }

    // Snapshot the set of affected students BEFORE deleting the row —
    // material_shares get cascaded away and we'd lose visibility data.
    await invalidateAffectedStudents(supabase, id, material.lesson_id ?? null)

    // Remove storage object first — if this fails we bail out so we don't
    // orphan the row pointing at a live file.
    if (material.storage_path) {
      const { error: rmErr } = await supabase.storage
        .from(BUCKET)
        .remove([material.storage_path])
      if (rmErr && !/not.*found/i.test(rmErr.message || '')) {
        console.error('Ошибка удаления файла из bucket:', rmErr)
        return NextResponse.json(
          { error: 'Не удалось удалить файл из хранилища' },
          { status: 500 }
        )
      }
    }

    const { error: delErr } = await supabase
      .from('materials')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherProfileId)
    if (delErr) {
      console.error('Ошибка удаления материала:', delErr)
      return NextResponse.json(
        { error: 'Не удалось удалить материал' },
        { status: 500 }
      )
    }

    invalidateTeacherMaterials(user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Непредвиденная ошибка DELETE material:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

// ---------------------------------------------------------------
// PATCH /api/teacher/materials/[id]
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

    const updatePayload: Record<string, unknown> = { ...parsed.data }

    // Validate lesson ownership if lesson_id is being changed to a value
    if (
      Object.prototype.hasOwnProperty.call(parsed.data, 'lesson_id') &&
      parsed.data.lesson_id
    ) {
      const { data: lessonRow, error: lessonErr } = await supabase
        .from('lessons')
        .select('id, teacher_id')
        .eq('id', parsed.data.lesson_id)
        .maybeSingle()
      if (lessonErr) {
        console.error('Ошибка проверки урока:', lessonErr)
        return NextResponse.json({ error: 'Ошибка базы данных' }, { status: 500 })
      }
      if (!lessonRow || lessonRow.teacher_id !== teacherProfileId) {
        return NextResponse.json(
          { error: 'Урок не найден или не принадлежит преподавателю' },
          { status: 403 }
        )
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('materials')
      .update(updatePayload)
      .eq('id', id)
      .eq('teacher_id', teacherProfileId)
      .select(
        'id, title, description, file_type, mime_type, file_size, level, tags, use_count, storage_path, file_url, lesson_id, is_public, created_at, updated_at'
      )
      .single()

    if (upErr) {
      console.error('Ошибка обновления материала:', upErr)
      return NextResponse.json(
        { error: 'Не удалось обновить материал' },
        { status: 500 }
      )
    }
    if (!updated) {
      return NextResponse.json({ error: 'Материал не найден' }, { status: 404 })
    }

    // Visibility-relevant fields (lesson_id, is_public, title/desc) may have
    // changed — re-evaluate the share/lesson set and invalidate.
    invalidateTeacherMaterials(user.id)
    await invalidateAffectedStudents(
      supabase,
      id,
      'lesson_id' in updatePayload ? (updatePayload.lesson_id as string | null) : updated.lesson_id ?? null
    )

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Непредвиденная ошибка PATCH material:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
