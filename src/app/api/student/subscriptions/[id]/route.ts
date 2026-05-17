// ---------------------------------------------------------------
// DELETE /api/student/subscriptions/[id]?from=YYYY-MM-DD
//
// Отмена подписки. Два режима:
//   - без ?from → полная отмена: status='cancelled', все будущие
//     lessons (от now()) переходят в cancelled.
//   - ?from=YYYY-MM-DD → частичная: ends_on = from-1, режутся
//     уроки с scheduled_at >= from (в TZ подписки).
//
// Owner-check делает RPC `cancel_lesson_subscription` (student =
// student_id; teacher через get_teacher_profile_id(); admin через
// is_admin()). 404, если RPC не нашёл subscription; 403 — если
// сессия не подходит ни под одну роль.
//
// Сам урок не трогаем — RPC меняет .status в lessons атомарно.
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit/log'
import { enforceRateLimitStrict } from '@/lib/api/rate-limit'
import {
  invalidateStudentDashboard,
  invalidateTeacherDashboard,
  invalidateTeacherStudents,
} from '@/lib/cache/invalidate'
import { notifySubscriptionCancelled } from '@/lib/notifications/subscription-events'

const idSchema = z.string().uuid('Некорректный ID подписки')
const fromSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'from должен быть YYYY-MM-DD')

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

    const { searchParams } = new URL(request.url)
    const fromRaw = searchParams.get('from')
    let from: string | null = null
    if (fromRaw) {
      const f = fromSchema.safeParse(fromRaw)
      if (!f.success) {
        return NextResponse.json(
          { error: f.error.issues[0]?.message ?? 'Некорректный from' },
          { status: 400 }
        )
      }
      from = f.data
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

    // Rate-limit отмен: 20/час с одного user'а. Отмена дешёвая (UPDATE +
    // одна транзакция), но защищаемся от спама.
    const limited = await enforceRateLimitStrict(request, {
      name: 'student:subscription:cancel',
      keyParts: [user.id],
      max: 20,
      windowSeconds: 60 * 60,
    })
    if (limited) return limited

    // Достаём контекст подписки ДО вызова RPC — нужен для cache invalidation
    // (нужны student_id и teacher's user_id) и audit payload. RLS пустит
    // только если user — owner/teacher/admin, что совпадает с тем, кого
    // пустит сам RPC. Если RLS не вернул строки → 404.
    type SubLookup = {
      id: string
      student_id: string
      teacher_id: string
      status: string
    }
    const { data: sub, error: subError } = await supabase
      .from('lesson_subscriptions' as any)
      .select('id, student_id, teacher_id, status')
      .eq('id', id)
      .maybeSingle<SubLookup>()

    if (subError) {
      console.error('[subscriptions/cancel] lookup failed', subError)
      return NextResponse.json(
        { error: 'Не удалось загрузить подписку' },
        { status: 500 }
      )
    }
    if (!sub) {
      // Либо нет такой подписки, либо RLS не пустил — для клиента это 404.
      return NextResponse.json(
        { error: 'Подписка не найдена' },
        { status: 404 }
      )
    }

    // Resolve teacher's auth user_id один раз — потом для invalidate.
    type TeacherUserLookup = { user_id: string }
    const { data: teacherUserRow } = await supabase
      .from('teacher_profiles')
      .select('user_id')
      .eq('id', sub.teacher_id)
      .maybeSingle<TeacherUserLookup>()
    const teacherUserId = teacherUserRow?.user_id ?? null

    // ---- RPC ----
    // FIXME(types): custom RPC не в Database typegen
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
      'cancel_lesson_subscription',
      {
        p_sub_id: id,
        p_from: from,
      }
    )

    if (rpcError) {
      const code = (rpcError as any)?.code
      console.error('[subscriptions/cancel] RPC failed', {
        message: rpcError.message,
        code,
      })
      if (code === '02000') {
        return NextResponse.json(
          { error: 'Подписка не найдена' },
          { status: 404 }
        )
      }
      if (code === '42501') {
        return NextResponse.json(
          { error: 'Нет прав на отмену этой подписки' },
          { status: 403 }
        )
      }
      if (code === '28000') {
        return NextResponse.json(
          { error: 'Необходимо авторизоваться' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Не удалось отменить подписку' },
        { status: 500 }
      )
    }

    const result = rpcResult as {
      ok: true
      subscription_id: string
      lessons_cancelled: number
    } | null

    const lessonsCancelled = result?.lessons_cancelled ?? 0

    // Cache invalidation: stats/upcoming на обоих дашбордах поменялись.
    invalidateStudentDashboard(sub.student_id)
    if (teacherUserId) {
      invalidateTeacherDashboard(teacherUserId)
      invalidateTeacherStudents(teacherUserId)
    }

    await logAuditEvent(request, {
      category: 'data',
      action: 'subscription_cancelled',
      target_type: 'lesson_subscriptions',
      target_id: id,
      payload: {
        cancelled_by: user.id,
        from: from,
        full_cancel: from === null,
        lessons_cancelled: lessonsCancelled,
        previous_status: sub.status,
      },
    })

    // Phase-4: уведомляем препода. Если отменил сам препод —
    // notifier увидит teacher.user_id === sub.teacher и тоже отправит
    // (это его действие → пусть имеет письменный след), но мы могли бы
    // тут skip'нуть; для consistency оставляем — он узнает из дашборда.
    void notifySubscriptionCancelled(
      createAdminClient(),
      id,
      from
    ).catch((err) =>
      console.error('[subscriptions/cancel] notify failed', err)
    )

    return NextResponse.json({
      ok: true,
      subscription_id: id,
      lessons_cancelled: lessonsCancelled,
    })
  } catch (error) {
    console.error('[subscriptions/cancel] unexpected', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
