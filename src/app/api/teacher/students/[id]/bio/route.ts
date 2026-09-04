// ---------------------------------------------------------------------------
// /api/teacher/students/[id]/bio
//
// GET   → { note: {content, updatedBy, updatedByName, updatedAt} | null }
// PATCH → body { content: string ≤500 }  ⇒  UPSERT
//
// Общая заметка «Об ученике» видна всем teacher/admin, редактируется любым
// (последний перезаписывает). Owner-check «этот ученик хоть раз был с этим
// учителем» — только для teacher, admin обходит.
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  content: z.string().max(500),
})

async function requireTeacherOrAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = (profile as { role: string } | null)?.role
  if (role !== 'teacher' && role !== 'admin') {
    return { error: 'Forbidden', status: 403 as const }
  }
  return { user, role }
}

async function isMyStudent(admin: any, teacherUserId: string, studentId: string): Promise<boolean> {
  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', teacherUserId)
    .maybeSingle()
  const teacherProfileId = tp?.id
  if (!teacherProfileId) return false
  const [{ data: anyLesson }, { data: anyTrial }] = await Promise.all([
    admin.from('lessons').select('id').eq('student_id', studentId).eq('teacher_id', teacherProfileId).limit(1).maybeSingle(),
    admin.from('trial_lesson_requests').select('id').eq('user_id', studentId).eq('assigned_teacher_id', teacherProfileId).in('status', ['assigned', 'scheduled']).limit(1).maybeSingle(),
  ])
  return !!anyLesson || !!anyTrial
}

async function loadNote(admin: any, studentId: string) {
  const { data: row } = await admin
    .from('student_shared_notes')
    .select('content, updated_by, updated_at')
    .eq('student_id', studentId)
    .maybeSingle()
  if (!row?.content) return null
  const authorId = (row as { updated_by: string | null }).updated_by
  let authorName: string | null = null
  if (authorId) {
    const { data: prof } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', authorId)
      .maybeSingle()
    authorName = (prof as { full_name: string | null } | null)?.full_name ?? null
  }
  return {
    content: (row as { content: string }).content,
    updatedBy: authorId,
    updatedByName: authorName,
    updatedAt: (row as { updated_at: string }).updated_at,
  }
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studentId } = await ctx.params
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    const supabase = await createClient()
    const gate = await requireTeacherOrAdmin(supabase)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const admin = createAdminClient() as any
    const note = await loadNote(admin, studentId)
    return NextResponse.json({ note })
  } catch (e) {
    console.error('[teacher/students/bio][GET] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studentId } = await ctx.params
    if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

    const supabase = await createClient()
    const gate = await requireTeacherOrAdmin(supabase)
    if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status })

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      )
    }
    const trimmed = parsed.data.content.trim().slice(0, 500)

    const admin = createAdminClient() as any

    if (gate.role === 'teacher') {
      const mine = await isMyStudent(admin, gate.user.id, studentId)
      if (!mine) return NextResponse.json({ error: 'Not your student' }, { status: 403 })
    }

    // Пустая content → удаляем строку (полная очистка «Об ученике»).
    if (trimmed.length === 0) {
      await admin.from('student_shared_notes').delete().eq('student_id', studentId)
      return NextResponse.json({ note: null })
    }

    const { error: upErr } = await admin
      .from('student_shared_notes')
      .upsert(
        {
          student_id: studentId,
          content: trimmed,
          updated_by: gate.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id' },
      )
    if (upErr) {
      console.error('[teacher/students/bio][PATCH] upsert failed', upErr)
      return NextResponse.json({ error: 'Не удалось сохранить' }, { status: 500 })
    }

    const note = await loadNote(admin, studentId)
    return NextResponse.json({ note })
  } catch (e) {
    console.error('[teacher/students/bio][PATCH] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
