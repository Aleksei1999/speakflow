// ---------------------------------------------------------------
// DELETE /api/lessons/[id]
//
// Отмена ОДНОГО урока (без затрагивания подписки, если урок входит
// в серию — subscription_id остаётся, ends_on не меняется).
//
// Когда стоит дёрнуть этот endpoint vs /api/booking/cancel:
//   - /api/booking/cancel — UI-обёртка с поддержкой refund-логики,
//     политикой 24ч, выбором reason. Это «человеческий» путь.
//   - DELETE /api/lessons/[id] — REST-удобство (фронт ожидает
//     стандартный REST), и точечная отмена ОДНОГО occurrence из
//     серии (студент не хочет конкретный вторник, но всю серию
//     оставляет). Refund-policy и notifyLessonCancelled здесь
//     намеренно НЕ дёргаем, чтобы избежать дабл-уведомления:
//     если нужна нотификация — фронт зовёт /api/booking/cancel.
//
// Body (optional): { reason: string }
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/log'
import { enforceRateLimitStrict } from '@/lib/api/rate-limit'
import {
  invalidateStudentDashboard,
  invalidateTeacherDashboard,
  invalidateTeacherStudents,
} from '@/lib/cache/invalidate'

const idSchema = z.string().uuid('Некорректный ID урока')
const bodySchema = z
  .object({
    reason: z.string().max(500, 'Максимум 500 символов').optional(),
  })
  .optional()

// Статусы, из которых ЗАПРЕЩЕНО переводить в cancelled.
const FROZEN_STATUSES = new Set([
  'cancelled',
  'completed',
  'no_show',
  'in_progress',
])

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idParsed = idSchema.safeParse(id)
    if (!idParsed.success) {
      return NextResponse.json(
        { error: idParsed.error.issues[0]?.message ?? 'Некорректный ID' },
        { status: 400 }
      )
    }

    // Body опционален (для чистого REST DELETE — обычно без тела).
    let reason: string | null = null
    const rawText = await request.text()
    if (rawText && rawText.trim().length > 0) {
      let json: unknown
      try {
        json = JSON.parse(rawText)
      } catch {
        return NextResponse.json(
          { error: 'Некорректный JSON в теле запроса' },
          { status: 400 }
        )
      }
      const parsed = bodySchema.safeParse(json)
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.issues[0]?.message ?? 'Некорректные данные',
          },
          { status: 400 }
        )
      }
      reason = parsed.data?.reason ?? null
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Необходимо авторизоваться' },
        { status: 401 }
      )
    }

    const limited = await enforceRateLimitStrict(request, {
      name: 'lessons:cancel',
      keyParts: [user.id],
      max: 20,
      windowSeconds: 60,
    })
    if (limited) return limited

    // ---- fetch lesson ----
    type LessonRow = {
      id: string
      student_id: string
      teacher_id: string
      scheduled_at: string
      duration_minutes: number
      status: string
      price: number
      subscription_id: string | null
    }
    const { data: lesson, error: lessonErr } = await supabase
      .from('lessons')
      .select(
        'id, student_id, teacher_id, scheduled_at, duration_minutes, status, price, subscription_id'
      )
      .eq('id', id)
      .maybeSingle<LessonRow>()

    if (lessonErr) {
      console.error('[lessons/delete] lookup failed', lessonErr)
      return NextResponse.json(
        { error: 'Не удалось загрузить урок' },
        { status: 500 }
      )
    }
    if (!lesson) {
      return NextResponse.json({ error: 'Урок не найден' }, { status: 404 })
    }

    // ---- authorization: student/teacher of this lesson, OR admin ----
    const isStudent = lesson.student_id === user.id

    const [tpRes, profRes] = await Promise.all([
      supabase
        .from('teacher_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle<{ id: string }>(),
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: string }>(),
    ])
    const isTeacher = !!(tpRes.data?.id && lesson.teacher_id === tpRes.data.id)
    const isAdmin = profRes.data?.role === 'admin'

    if (!isStudent && !isTeacher && !isAdmin) {
      return NextResponse.json(
        { error: 'Нет прав на отмену этого урока' },
        { status: 403 }
      )
    }

    // ---- status guard ----
    if (FROZEN_STATUSES.has(lesson.status)) {
      return NextResponse.json(
        { error: `Нельзя отменить урок со статусом "${lesson.status}"` },
        { status: 400 }
      )
    }

    // ---- update (atomic on (id, status NOT IN frozen)) ----
    // Двойная защита: если другой запрос параллельно переведёт урок в
    // completed/in_progress, .neq()-фильтр срежет наш UPDATE.
    // FIXME(types): Postgrest UpdateBuilder инференсится в never
    const { data: updated, error: updErr } = await (supabase.from('lessons') as any)
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancellation_reason: reason,
      })
      .eq('id', id)
      .not('status', 'in', '(cancelled,completed,no_show,in_progress)')
      .select('id, status')

    if (updErr) {
      console.error('[lessons/delete] update failed', updErr)
      return NextResponse.json(
        { error: 'Не удалось отменить урок' },
        { status: 500 }
      )
    }
    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      // race: статус успели поменять между select и update
      return NextResponse.json(
        {
          error:
            'Урок уже не может быть отменён (статус изменился). Обновите страницу.',
        },
        { status: 409 }
      )
    }

    // ---- cache invalidation ----
    invalidateStudentDashboard(lesson.student_id)
    {
      const { data: tRow } = await supabase
        .from('teacher_profiles')
        .select('user_id')
        .eq('id', lesson.teacher_id)
        .maybeSingle<{ user_id: string }>()
      if (tRow?.user_id) {
        invalidateTeacherDashboard(tRow.user_id)
        invalidateTeacherStudents(tRow.user_id)
      }
    }

    // ---- audit ----
    await logAuditEvent(request, {
      category: 'data',
      action: 'lesson_cancelled',
      target_type: 'lessons',
      target_id: id,
      payload: {
        cancelled_by: user.id,
        cancelled_by_role: isStudent ? 'student' : isTeacher ? 'teacher' : 'admin',
        reason: reason ? reason.slice(0, 200) : null,
        previous_status: lesson.status,
        subscription_id: lesson.subscription_id,
        scheduled_at: lesson.scheduled_at,
        via: 'rest_delete',
      },
    })

    return NextResponse.json({
      ok: true,
      lesson_id: id,
      // True если урок был occurrence в серии. UI может показать
      // подсказку «остальные уроки серии не отменены».
      from_subscription: lesson.subscription_id !== null,
    })
  } catch (error) {
    console.error('[lessons/delete] unexpected', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
