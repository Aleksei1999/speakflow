// ---------------------------------------------------------------------------
// PATCH /api/teacher/students/[id]/level
//
// Учитель меняет english_level ученика в модалке «Об ученике».
// UPSERT в user_progress (student → одна строка на user_id).
//
// Auth: teacher / admin. Дополнительно проверяем что учитель реально ведёт
// этого ученика (в списке teacher-students через lessons ИЛИ trial-request),
// чтобы левый учитель не мог менять чужих учеников.
//
// Тело: { level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' }
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateTeacherStudents, invalidateStudentDashboard } from '@/lib/cache/invalidate'
import { toRoastLevel } from '@/lib/levels/mapping'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const bodySchema = z.object({
  level: z.enum(LEVELS),
})

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: studentId } = await ctx.params
    if (!studentId) {
      return NextResponse.json({ error: 'studentId required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>()
    if (!profile || (profile.role !== 'teacher' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    const { level } = parsed.data

    const admin = createAdminClient() as any

    // Owner-check: учитель должен вести этого ученика. Admin — обход.
    if (profile.role === 'teacher') {
      const { data: tp } = await admin
        .from('teacher_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      const teacherProfileId = tp?.id
      if (!teacherProfileId) {
        return NextResponse.json({ error: 'teacher_profiles not found' }, { status: 403 })
      }
      // Есть хоть один урок этого ученика с этим учителем ИЛИ активная trial-заявка.
      const [{ data: anyLesson }, { data: anyTrial }] = await Promise.all([
        admin
          .from('lessons')
          .select('id')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherProfileId)
          .limit(1)
          .maybeSingle(),
        admin
          .from('trial_lesson_requests')
          .select('id')
          .eq('user_id', studentId)
          .eq('assigned_teacher_id', teacherProfileId)
          .in('status', ['assigned', 'scheduled'])
          .limit(1)
          .maybeSingle(),
      ])
      if (!anyLesson && !anyTrial) {
        return NextResponse.json({ error: 'Not your student' }, { status: 403 })
      }
    }

    // UPSERT user_progress (одна строка на user_id).
    // DB CHECK хранит роаст-уровни (Raw..Well Done) — миграция 011.
    const upRes = await admin
      .from('user_progress')
      .upsert(
        { user_id: studentId, english_level: toRoastLevel(level) },
        { onConflict: 'user_id' },
      )
    if (upRes.error) {
      console.error('[teacher/students/level] upsert failed', upRes.error)
      return NextResponse.json({ error: 'Не удалось сохранить уровень' }, { status: 500 })
    }

    // Cache invalidation — teacher list уровень читает, student snapshot тоже.
    invalidateTeacherStudents(user.id)
    invalidateStudentDashboard(studentId)

    return NextResponse.json({ ok: true, level })
  } catch (e) {
    console.error('[teacher/students/level] Unexpected error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
