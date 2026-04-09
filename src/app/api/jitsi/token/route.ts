// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateJitsiToken } from '@/lib/jitsi/jwt'
import { JITSI_CONFIG } from '@/lib/jitsi/config'
import { LESSON_JOIN_WINDOW } from '@/lib/constants'

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
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, student_id, teacher_id, scheduled_at, duration_minutes, status, jitsi_room_name')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Урок не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что пользователь -- участник урока
    const isStudent = lesson.student_id === user.id
    const isTeacher = lesson.teacher_id === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json(
        { error: 'Вы не являетесь участником этого урока' },
        { status: 403 }
      )
    }

    // --- 4. Проверка статуса урока ---
    if (lesson.status !== 'booked' && lesson.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Урок недоступен для подключения' },
        { status: 409 }
      )
    }

    // --- 5. Проверка временного окна ---
    const now = new Date()
    const scheduledAt = new Date(lesson.scheduled_at)
    const lessonEnd = new Date(scheduledAt.getTime() + lesson.duration_minutes * 60 * 1000)
    const joinWindowStart = new Date(scheduledAt.getTime() - LESSON_JOIN_WINDOW * 60 * 1000)

    if (now < joinWindowStart) {
      const minutesUntilJoin = Math.ceil((joinWindowStart.getTime() - now.getTime()) / 60000)
      return NextResponse.json(
        { error: `Подключение будет доступно через ${minutesUntilJoin} мин` },
        { status: 425 }
      )
    }

    // Разрешаем 15 минут буфера после окончания для завершения разговора
    const bufferEnd = new Date(lessonEnd.getTime() + 15 * 60 * 1000)
    if (now > bufferEnd) {
      return NextResponse.json(
        { error: 'Время урока истекло' },
        { status: 410 }
      )
    }

    // --- 6. Обновление статуса на in_progress при первом подключении ---
    if (lesson.status === 'booked') {
      const adminSupabase = createAdminClient()
      await adminSupabase
        .from('lessons')
        .update({ status: 'in_progress' })
        .eq('id', lessonId)
        .eq('status', 'booked')
    }

    // --- 7. Получение профиля пользователя ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single()

    // --- 8. Генерация JWT ---
    const roomName = lesson.jitsi_room_name ?? lessonId

    const token = await generateJitsiToken(roomName, {
      id: user.id,
      name: profile?.full_name ?? 'Участник',
      email: profile?.email ?? user.email ?? '',
      avatarUrl: profile?.avatar_url,
      isModerator: isTeacher,
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
