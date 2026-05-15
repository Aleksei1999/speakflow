import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateJitsiToken } from '@/lib/jitsi/jwt'
import { JITSI_CONFIG } from '@/lib/jitsi/config'
import { LESSON_JOIN_WINDOW, LESSON_POST_WINDOW } from '@/lib/constants'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { logAuditEvent } from '@/lib/audit/log'

const tokenRequestSchema = z.object({
  lessonId: z.string().uuid('Некорректный ID урока'),
})

export async function POST(request: NextRequest) {
  try {
    // --- 1. Аутентификация ---
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Необходима авторизация' },
        { status: 401 }
      )
    }

    // 60 токенов в минуту — комната переподключается, но это потолок
    // здравой передeлки JWT для одного юзера. fail-closed:
    // токен выдаёт доступ к видеокомнате, лучше отказать.
    const limited = await enforceRateLimitStrict(request, {
      name: 'jitsi:token',
      keyParts: [user.id, getClientIp(request)],
      max: 60,
      windowSeconds: 60,
    })
    if (limited) return limited

    // --- 2. Валидация входных данных ---
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Некорректный формат запроса' },
        { status: 400 }
      )
    }

    const parsed = tokenRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      )
    }

    const { lessonId } = parsed.data

    // --- 3. Получение урока и проверка участия ---
    type LessonRow = {
      id: string
      student_id: string
      teacher_id: string
      scheduled_at: string
      duration_minutes: number
      status: string
      jitsi_room_name: string | null
    }
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, student_id, teacher_id, scheduled_at, duration_minutes, status, jitsi_room_name')
      .eq('id', lessonId)
      .single<LessonRow>()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Урок не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что пользователь -- участник урока.
    // student_id хранит auth.uid(), teacher_id — teacher_profiles.id,
    // поэтому учителя приходится резолвить через teacher_profiles.
    // Три признака считаем НЕЗАВИСИМО. Раньше teacher/admin lookup
    // пропускался если isStudent — это давало некорректный isAdmin=false
    // для админа-участника. Сейчас admin всегда admin.
    const isStudent = lesson.student_id === user.id

    const [{ data: tp }, { data: prof }] = await Promise.all([
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
    const isTeacher = !!(tp?.id && lesson.teacher_id === tp.id)
    const isAdmin = prof?.role === 'admin'

    if (!isStudent && !isTeacher && !isAdmin) {
      return NextResponse.json(
        { error: 'Вы не являетесь участником этого урока' },
        { status: 403 }
      )
    }

    // --- 4. Проверка статуса урока ---
    if (lesson.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Урок отменён' },
        { status: 409 }
      )
    }
    if (lesson.status !== 'booked' && lesson.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Урок недоступен для подключения' },
        { status: 409 }
      )
    }

    // --- 5. Проверка временного окна ---
    // openAt  = scheduled_at - LESSON_JOIN_WINDOW мин (5 мин до старта)
    // closeAt = scheduled_at + duration_minutes + LESSON_POST_WINDOW мин (5 мин после окончания)
    const nowMs = Date.now()
    const scheduledMs = new Date(lesson.scheduled_at).getTime()
    const openAtMs = scheduledMs - LESSON_JOIN_WINDOW * 60 * 1000
    const closeAtMs = scheduledMs + lesson.duration_minutes * 60 * 1000 + LESSON_POST_WINDOW * 60 * 1000

    if (nowMs < openAtMs) {
      const minutesUntilJoin = Math.ceil((openAtMs - nowMs) / 60000)
      return NextResponse.json(
        { error: `Комната откроется за ${LESSON_JOIN_WINDOW} мин до старта (через ~${minutesUntilJoin} мин)` },
        { status: 425 }
      )
    }

    if (nowMs > closeAtMs) {
      return NextResponse.json(
        { error: 'Время урока истекло' },
        { status: 410 }
      )
    }

    // --- 6. Обновление статуса на in_progress при первом подключении ---
    if (lesson.status === 'booked') {
      const adminSupabase = createAdminClient()
      // FIXME(types): Postgrest UpdateBuilder инференсится в never
      await (adminSupabase.from('lessons') as any)
        .update({ status: 'in_progress' })
        .eq('id', lessonId)
        .eq('status', 'booked')
    }

    // --- 7. Получение профиля пользователя ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single<{ full_name: string | null; email: string | null; avatar_url: string | null }>()

    // --- 8. Генерация JWT ---
    const roomName = lesson.jitsi_room_name ?? lessonId

    const token = await generateJitsiToken(roomName, {
      id: user.id,
      name: profile?.full_name ?? 'Участник',
      email: profile?.email ?? user.email ?? '',
      avatarUrl: profile?.avatar_url,
      isModerator: isTeacher || isAdmin,
    })

    // Audit: какой токен выдан на какую комнату/урок. Сам JWT НЕ логируем —
    // только room/exp/role и user. Это даёт цепочку «кто заходил в урок».
    // exp вычисляется внутри generateJitsiToken; для аудита берём ожидаемое
    // окно (closeAtMs) — это потолок легитимного использования токена.
    const roleInLesson = isTeacher ? 'teacher' : isAdmin ? 'admin' : 'student'
    await logAuditEvent(request, {
      category: 'data',
      action: 'jitsi_token_issued',
      target_type: 'lessons',
      target_id: lessonId,
      payload: {
        room: roomName,
        exp_at: new Date(closeAtMs).toISOString(),
        role_in_lesson: roleInLesson,
        is_moderator: isTeacher || isAdmin,
      },
    })

    return NextResponse.json({
      token,
      domain: JITSI_CONFIG.domain,
      roomName,
    })
  } catch (error) {
    console.error('[jitsi/token] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
