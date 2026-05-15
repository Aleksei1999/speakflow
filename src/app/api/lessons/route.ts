import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/lessons
 *
 * Лёгкий aggregator для клиентов, ожидающих REST-эндпоинт
 * `/api/lessons` (раньше отдавал 404). Возвращает уроки текущего
 * пользователя, чей aspect зависит от его роли:
 *   - student  → lessons.student_id = auth.user.id
 *   - teacher  → lessons.teacher_id = teacher_profiles.id (FK by user_id)
 *
 * Запрос: GET /api/lessons?status=booked,in_progress&limit=50
 *   - status — CSV статусов (любые из:
 *              booked,in_progress,completed,cancelled,no_show,pending_payment)
 *              если не задан — отдаём все активные (без cancelled/no_show)
 *   - limit  — 1..200 (default 50)
 *
 * Замечание: основная бронь-логика живёт в /api/booking/*. Этот route —
 * read-only удобство, чтобы фронт мог дёрнуть один URL.
 */
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

    // Парсим query
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const limitRaw = Number(searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.trunc(limitRaw)))
      : 50

    const ALL_STATUSES = [
      'booked',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'pending_payment',
    ] as const
    type LessonStatus = (typeof ALL_STATUSES)[number]

    let statuses: LessonStatus[]
    if (statusParam) {
      const requested = statusParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as LessonStatus[]
      statuses = requested.filter((s) =>
        (ALL_STATUSES as readonly string[]).includes(s)
      ) as LessonStatus[]
      if (statuses.length === 0) {
        return NextResponse.json(
          { error: 'Параметр status содержит некорректные значения' },
          { status: 400 }
        )
      }
    } else {
      // По умолчанию — активные.
      statuses = [
        'booked',
        'in_progress',
        'completed',
        'pending_payment',
      ]
    }

    // Определяем роль для выбора колонки фильтрации.
    const { data: profile, error: profErr } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()) as { data: { role: 'student' | 'teacher' | 'admin' } | null; error: any }

    if (profErr || !profile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
      )
    }

    let query = supabase
      .from('lessons')
      .select(
        'id, student_id, teacher_id, scheduled_at, duration_minutes, status, price, jitsi_room_name, created_at'
      )
      .in('status', statuses)
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    if (profile.role === 'teacher') {
      // teacher_id в lessons — это teacher_profiles.id, а не auth.user.id
      const { data: tp, error: tpErr } = (await supabase
        .from('teacher_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()) as { data: { id: string } | null; error: any }

      if (tpErr) {
        console.error('[/api/lessons] teacher_profiles lookup failed', tpErr)
        return NextResponse.json(
          { error: 'Не удалось загрузить уроки' },
          { status: 500 }
        )
      }

      if (!tp?.id) {
        // Преподавательский профиль ещё не создан — пустой список.
        return NextResponse.json({ lessons: [] })
      }

      query = query.eq('teacher_id', tp.id)
    } else {
      query = query.eq('student_id', user.id)
    }

    const { data: lessons, error: lessonsErr } = await query

    if (lessonsErr) {
      console.error('[/api/lessons] select failed', lessonsErr)
      return NextResponse.json(
        { error: 'Не удалось загрузить уроки' },
        { status: 500 }
      )
    }

    return NextResponse.json({ lessons: lessons ?? [] })
  } catch (error) {
    console.error('[/api/lessons] unexpected error', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
