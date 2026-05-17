// ---------------------------------------------------------------
// POST /api/student/subscriptions
//
// Создаёт регулярный «закреплённый» слот: подписка
// (lesson_subscriptions) + материализованные lessons на rolling
// 14-day window. Реальный hard-work делает RPC
// `create_lesson_subscription` (миграция 082) — мы только
// валидируем вход, проверяем роль + существование преподавателя,
// rate-лимитим и пишем business-audit поверх SQL-аудита.
//
// Конфликт слотов → 409 + список occurrences. Подписка в этом
// случае не создаётся (RPC откатывает транзакцию).
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit/log'
import { enforceRateLimitStrict } from '@/lib/api/rate-limit'
import { notifySubscriptionCreated } from '@/lib/notifications/subscription-events'

// ---- validation ------------------------------------------------

const patternEntrySchema = z.object({
  dow: z.number().int().min(0).max(6),
  time: z
    .string()
    .regex(/^[0-2][0-9]:[0-5][0-9]$/, 'time должен быть HH:MM'),
  duration_min: z.number().int().min(15).max(180),
})

const createSubscriptionSchema = z
  .object({
    teacher_id: z.string().uuid('Некорректный ID преподавателя'),
    pattern: z
      .array(patternEntrySchema)
      .min(1, 'Паттерн не может быть пустым')
      .max(14, 'Максимум 14 слотов в неделю'),
    starts_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'starts_on должен быть YYYY-MM-DD'),
    weeks: z.number().int().min(1).max(26),
  })
  .superRefine((val, ctx) => {
    // Защита от дублей в pattern: (dow, time) уникальны.
    const seen = new Set<string>()
    for (const e of val.pattern) {
      const key = `${e.dow}-${e.time}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Дубликат слота в паттерне: dow=${e.dow}, time=${e.time}`,
          path: ['pattern'],
        })
        return
      }
      seen.add(key)
    }
    // starts_on не в прошлом (грубая проверка; RPC сделает точную в TZ
    // подписки — Europe/Moscow). Берём UTC date, чтобы не упасть на
    // edge-case в полночь МСК.
    const today = new Date().toISOString().slice(0, 10)
    if (val.starts_on < today) {
      ctx.addIssue({
        code: 'custom',
        message: 'starts_on не может быть в прошлом',
        path: ['starts_on'],
      })
    }
  })

// ---- GET -------------------------------------------------------
// GET /api/student/subscriptions
// GET /api/student/subscriptions?teacher_id=<uuid>
//
// Возвращает active подписки текущего студента. С ?teacher_id
// фильтрует по одному преподу — этим UI («Закрепить время?»)
// решает, показывать post-lesson попап или нет. Status фильтруется
// по 'active' (не cancelled / ended).
// ---------------------------------------------------------------

const teacherIdQuerySchema = z
  .string()
  .uuid('Некорректный ID преподавателя')
  .optional()

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const teacherIdRaw = searchParams.get('teacher_id') ?? undefined
    const teacherIdParsed = teacherIdQuerySchema.safeParse(teacherIdRaw)
    if (!teacherIdParsed.success) {
      return NextResponse.json(
        {
          error:
            teacherIdParsed.error.issues[0]?.message ??
            'Некорректный teacher_id',
        },
        { status: 400 }
      )
    }
    const teacherId = teacherIdParsed.data

    // RLS на lesson_subscriptions пускает student к своим строкам.
    // Selecting * — серверный response, поля стабильны (миграция 082).
    let q = supabase
      .from('lesson_subscriptions' as any)
      .select(
        'id, teacher_id, student_id, pattern, starts_on, ends_on, status, weeks, created_at'
      )
      .eq('student_id', user.id)
      .eq('status', 'active')

    if (teacherId) q = q.eq('teacher_id', teacherId)

    type SubRow = {
      id: string
      teacher_id: string
      student_id: string
      pattern: any
      starts_on: string
      ends_on: string | null
      status: string
      weeks: number
      created_at: string
    }
    const { data, error } = (await q) as { data: SubRow[] | null; error: any }
    if (error) {
      console.error('[subscriptions/list] failed', error)
      return NextResponse.json(
        { error: 'Не удалось загрузить подписки' },
        { status: 500 }
      )
    }

    return NextResponse.json({ subscriptions: data ?? [] })
  } catch (error) {
    console.error('[subscriptions/list] unexpected', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// ---- POST ------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Некорректный JSON в теле запроса' },
        { status: 400 }
      )
    }

    const parsed = createSubscriptionSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { teacher_id, pattern, starts_on, weeks } = parsed.data

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

    // Strict rate-limit: подписки — тяжёлая операция (1-26 недель × N слотов
    // материализуются сразу). 5 в час с одного user'а — больше нормальному
    // студенту не нужно.
    const limited = await enforceRateLimitStrict(request, {
      name: 'student:subscription:create',
      keyParts: [user.id],
      max: 5,
      windowSeconds: 60 * 60,
    })
    if (limited) return limited

    // Только student роль может создавать подписки.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
      )
    }
    if (profile.role !== 'student') {
      return NextResponse.json(
        { error: 'Только студенты могут оформлять подписки' },
        { status: 403 }
      )
    }

    // Проверяем что teacher существует и активен.
    // teacher_id в схеме — это teacher_profiles.id (PK), не auth.user.id.
    // Принимаем именно PK, как и в RPC: фронт берёт его из карточки препода.
    type TeacherLite = {
      id: string
      is_listed: boolean
    }
    const { data: teacher, error: teacherError } = await supabase
      .from('teacher_profiles')
      .select('id, is_listed')
      .eq('id', teacher_id)
      .maybeSingle<TeacherLite>()

    if (teacherError) {
      console.error('[subscriptions/create] teacher lookup failed', teacherError)
      return NextResponse.json(
        { error: 'Ошибка проверки преподавателя' },
        { status: 500 }
      )
    }
    if (!teacher) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }
    if (!teacher.is_listed) {
      return NextResponse.json(
        { error: 'Преподаватель временно не принимает учеников' },
        { status: 400 }
      )
    }

    // ---- RPC call ----
    // FIXME(types): Postgrest rpc generic не резолвится для custom RPC без typegen.
    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
      'create_lesson_subscription',
      {
        p_teacher_id: teacher_id,
        p_pattern: pattern,
        p_starts_on: starts_on,
        p_weeks: weeks,
      }
    )

    if (rpcError) {
      console.error('[subscriptions/create] RPC failed', {
        message: rpcError.message,
        code: (rpcError as any)?.code,
        details: (rpcError as any)?.details,
      })

      // RPC raises ERRCODE 22023 для bad input. Маппим в 400.
      const code = (rpcError as any)?.code
      if (code === '22023') {
        return NextResponse.json(
          { error: rpcError.message || 'Некорректные параметры подписки' },
          { status: 400 }
        )
      }
      if (code === '23503') {
        return NextResponse.json(
          { error: 'Преподаватель не найден' },
          { status: 404 }
        )
      }
      if (code === '28000') {
        return NextResponse.json(
          { error: 'Необходимо авторизоваться' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Не удалось создать подписку' },
        { status: 500 }
      )
    }

    // RPC возвращает либо {ok:true, subscription_id, lessons_created},
    // либо {ok:false, conflicts:[{at, dow, time}, ...]}.
    const result = rpcResult as
      | { ok: true; subscription_id: string; lessons_created: number }
      | { ok: false; conflicts: Array<{ at: string; dow: number; time: string }> }

    if (!result?.ok) {
      // 409: фронт покажет какие именно слоты заняты.
      return NextResponse.json(
        {
          error: 'Один или несколько слотов уже заняты',
          conflicts: result?.conflicts ?? [],
        },
        { status: 409 }
      )
    }

    // ---- audit ----
    // Business-level: data-trigger тоже ловит INSERT в lesson_subscriptions,
    // но эта запись добавляет читаемый pattern preview и lessons_created.
    await logAuditEvent(request, {
      category: 'data',
      action: 'subscription_created',
      target_type: 'lesson_subscriptions',
      target_id: result.subscription_id,
      payload: {
        teacher_id,
        weeks,
        pattern_size: pattern.length,
        // Полный pattern полезен для рассмотрения incident'ов.
        pattern,
        starts_on,
        lessons_created: result.lessons_created,
      },
    })

    // Phase-4 нотификация преподу (email + telegram, локализация по
    // teacher.profile.language). Fire-and-forget — никогда не валим
    // ответ API из-за email/tg-ошибки.
    void notifySubscriptionCreated(
      createAdminClient(),
      result.subscription_id
    ).catch((err) =>
      console.error('[subscriptions/create] notify failed', err)
    )

    return NextResponse.json(
      {
        subscription_id: result.subscription_id,
        lessons_created: result.lessons_created,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[subscriptions/create] unexpected', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
