// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// PATCH actions:
//   action='review'  — set teacher_feedback, score_10/grade, status='reviewed', reviewed_at=now()
//   action='remind'  — bump reminders_count, set last_reminded_at=now()
//   action='edit'    — edit title/description/due_date/attachments (only before submission)
//   action='mark_overdue' — force status='overdue'
// ---------------------------------------------------------------

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(1000),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().trim().max(200).optional(),
})

const reviewSchema = z.object({
  action: z.literal('review'),
  teacher_feedback: z.string().trim().max(4000).optional().nullable(),
  score_10: z.number().min(0).max(10).optional().nullable(),
  grade: z.number().int().min(0).max(100).optional().nullable(),
})

const remindSchema = z.object({
  action: z.literal('remind'),
})

const editSchema = z.object({
  action: z.literal('edit'),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  due_date: z.string().datetime().optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
})

const markOverdueSchema = z.object({
  action: z.literal('mark_overdue'),
})

const patchSchema = z.discriminatedUnion('action', [
  reviewSchema,
  remindSchema,
  editSchema,
  markOverdueSchema,
])

async function assertTeacherOwnsHomework(
  supabase: any,
  userId: string,
  homeworkId: string
) {
  const { data: hw, error } = await supabase
    .from('homework')
    .select('*')
    .eq('id', homeworkId)
    .maybeSingle()
  if (error) {
    return { error: 'Ошибка базы данных', status: 500 as const }
  }
  if (!hw) {
    return { error: 'Задание не найдено', status: 404 as const }
  }
  if (hw.teacher_id !== userId) {
    return { error: 'Нет доступа к этому заданию', status: 403 as const }
  }
  return { hw }
}

async function verifyTeacher(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (!profile || profile.role !== 'teacher') {
    return { error: 'Доступ разрешён только преподавателям', status: 403 as const }
  }
  return { ok: true as const }
}

// ---------------------------------------------------------------
// GET /api/teacher/homework/[id]
// ---------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const t = await verifyTeacher(supabase, user.id)
    if ('error' in t) return NextResponse.json({ error: t.error }, { status: t.status })

    const own = await assertTeacherOwnsHomework(supabase, user.id, id)
    if ('error' in own) {
      return NextResponse.json({ error: own.error }, { status: own.status })
    }
    const hw = own.hw

    // Enrich with student + lesson
    const [{ data: prof }, { data: prog }, lesson] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', hw.student_id)
        .maybeSingle(),
      supabase
        .from('user_progress')
        .select('user_id, english_level')
        .eq('user_id', hw.student_id)
        .maybeSingle(),
      hw.lesson_id
        ? supabase
            .from('lessons')
            .select('id, scheduled_at')
            .eq('id', hw.lesson_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    return NextResponse.json({
      homework: {
        ...hw,
        score_10: hw.score_10 !== null ? Number(hw.score_10) : null,
        attachments: Array.isArray(hw.attachments) ? hw.attachments : [],
        student: prof
          ? {
              id: prof.id,
              full_name: prof.full_name,
              avatar_url: prof.avatar_url,
              email: prof.email,
              english_level: prog?.english_level || null,
            }
          : null,
        lesson: lesson?.data || null,
      },
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в GET /api/teacher/homework/[id]:', err)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// PATCH /api/teacher/homework/[id]
// ---------------------------------------------------------------
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const t = await verifyTeacher(supabase, user.id)
    if ('error' in t) return NextResponse.json({ error: t.error }, { status: t.status })

    const own = await assertTeacherOwnsHomework(supabase, user.id, id)
    if ('error' in own) {
      return NextResponse.json({ error: own.error }, { status: own.status })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Ожидается JSON-тело запроса' },
        { status: 400 }
      )
    }
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const update: Record<string, any> = {}

    switch (parsed.data.action) {
      case 'review': {
        const { teacher_feedback, score_10, grade } = parsed.data
        update.teacher_feedback = teacher_feedback ?? null
        if (typeof score_10 === 'number') {
          update.score_10 = Math.round(score_10 * 10) / 10
          // Also sync the legacy 0..100 grade for back-compat
          update.grade = Math.round(score_10 * 10)
        }
        if (typeof grade === 'number') {
          update.grade = Math.round(grade)
          if (typeof score_10 !== 'number') {
            update.score_10 = Math.round(grade) / 10
          }
        }
        update.status = 'reviewed'
        update.reviewed_at = new Date().toISOString()
        break
      }
      case 'remind': {
        update.reminders_count = (own.hw.reminders_count || 0) + 1
        update.last_reminded_at = new Date().toISOString()
        break
      }
      case 'edit': {
        // Don't allow editing assignment details after submission
        if (
          own.hw.status === 'submitted' ||
          own.hw.status === 'reviewed'
        ) {
          return NextResponse.json(
            { error: 'Нельзя редактировать задание после сдачи' },
            { status: 400 }
          )
        }
        const { title, description, due_date, attachments } = parsed.data
        if (title !== undefined) update.title = title
        if (description !== undefined) update.description = description
        if (due_date !== undefined) {
          update.due_date = new Date(due_date).toISOString()
          // Recompute status if was overdue and new due is in future
          if (
            own.hw.status === 'overdue' &&
            new Date(update.due_date).getTime() > Date.now()
          ) {
            update.status = 'pending'
          } else if (
            (own.hw.status === 'pending' || own.hw.status === 'in_progress') &&
            new Date(update.due_date).getTime() < Date.now()
          ) {
            update.status = 'overdue'
          }
        }
        if (attachments !== undefined) update.attachments = attachments
        break
      }
      case 'mark_overdue': {
        update.status = 'overdue'
        break
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('homework')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (updErr) {
      console.error('Ошибка обновления homework:', updErr)
      return NextResponse.json(
        { error: 'Не удалось обновить задание' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      homework: {
        ...updated,
        score_10: updated.score_10 !== null ? Number(updated.score_10) : null,
        attachments: Array.isArray(updated.attachments) ? updated.attachments : [],
      },
    })
  } catch (err) {
    console.error('Непредвиденная ошибка в PATCH /api/teacher/homework/[id]:', err)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// DELETE /api/teacher/homework/[id]
// ---------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const t = await verifyTeacher(supabase, user.id)
    if ('error' in t) return NextResponse.json({ error: t.error }, { status: t.status })

    const own = await assertTeacherOwnsHomework(supabase, user.id, id)
    if ('error' in own) {
      return NextResponse.json({ error: own.error }, { status: own.status })
    }

    const { error: delErr } = await supabase
      .from('homework')
      .delete()
      .eq('id', id)
    if (delErr) {
      console.error('Ошибка удаления homework:', delErr)
      return NextResponse.json(
        { error: 'Не удалось удалить задание' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Непредвиденная ошибка в DELETE /api/teacher/homework/[id]:', err)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
