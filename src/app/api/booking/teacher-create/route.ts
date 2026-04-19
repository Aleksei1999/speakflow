// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { teacherBookingSchema } from '@/lib/validations'

/**
 * POST /api/booking/teacher-create
 *
 * Учитель создаёт урок для ученика. Урок создаётся в статусе pending_payment —
 * оплату делает ученик позже. Валидация, проверка занятости слота и расчёт цены
 * повторяют логику /api/booking/create, но роль инициатора инвертирована.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = teacherBookingSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { studentId, scheduledAt, durationMinutes } = parsed.data

    const supabase = await createClient()

    // Auth
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

    // Проверяем роль текущего пользователя — должен быть teacher
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
      )
    }

    if (currentProfile.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Только преподаватели могут назначать уроки ученикам' },
        { status: 403 }
      )
    }

    // teacher_profiles для текущего учителя (auth user_id -> teacher_profiles.id)
    const { data: teacherProfile, error: teacherError } = await supabase
      .from('teacher_profiles')
      .select('id, hourly_rate, trial_rate')
      .eq('user_id', user.id)
      .single()

    if (teacherError || !teacherProfile) {
      return NextResponse.json(
        { error: 'Профиль преподавателя не найден' },
        { status: 404 }
      )
    }

    const teacherProfileId = teacherProfile.id

    // Ученик не может быть самим учителем
    if (studentId === user.id) {
      return NextResponse.json(
        { error: 'Нельзя назначить урок самому себе' },
        { status: 400 }
      )
    }

    // Проверяем, что studentId — существующий пользователь с ролью student
    const { data: studentProfile, error: studentError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', studentId)
      .single()

    if (studentError || !studentProfile) {
      return NextResponse.json(
        { error: 'Ученик не найден' },
        { status: 404 }
      )
    }

    if (studentProfile.role !== 'student') {
      return NextResponse.json(
        { error: 'Указанный пользователь не является учеником' },
        { status: 400 }
      )
    }

    // Время: в будущем и не более +30 дней
    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Некорректная дата урока' },
        { status: 400 }
      )
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Нельзя назначить урок на прошедшее время' },
        { status: 400 }
      )
    }
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30)
    if (scheduledDate > maxDate) {
      return NextResponse.json(
        { error: 'Нельзя назначить урок более чем на 30 дней вперёд' },
        { status: 400 }
      )
    }

    // Длительность: 25 или 50
    if (durationMinutes !== 25 && durationMinutes !== 50) {
      return NextResponse.json(
        { error: 'Длительность должна быть 25 или 50 минут' },
        { status: 400 }
      )
    }

    // Проверка доступности слота (p_teacher_id = teacher_profiles.id)
    const { data: isAvailable, error: slotError } = await supabase.rpc(
      'is_slot_available',
      {
        p_teacher_id: teacherProfileId,
        p_scheduled_at: scheduledAt,
        p_duration: durationMinutes,
      }
    )

    if (slotError) {
      console.error('Ошибка проверки доступности слота:', slotError)
      return NextResponse.json(
        { error: 'Ошибка проверки доступности слота' },
        { status: 500 }
      )
    }

    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Выбранное время уже занято. Пожалуйста, выберите другой слот.' },
        { status: 409 }
      )
    }

    // Цена: trial_rate если это первый урок между этим учителем и учеником,
    // иначе hourly_rate. Копируем ту же логику, что и в /api/booking/create.
    const hourlyRate = teacherProfile.hourly_rate
    let price: number
    if (teacherProfile.trial_rate !== null) {
      const { count: previousLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherProfileId)
        .in('status', ['booked', 'completed', 'in_progress'])

      if (previousLessons === 0) {
        price = Math.round((teacherProfile.trial_rate * durationMinutes) / 60)
      } else {
        price = Math.round((hourlyRate * durationMinutes) / 60)
      }
    } else {
      price = Math.round((hourlyRate * durationMinutes) / 60)
    }

    // Инсерт в lessons
    const { data: lesson, error: insertError } = await supabase
      .from('lessons')
      .insert({
        student_id: studentId,
        teacher_id: teacherProfileId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        status: 'pending_payment',
        price,
        jitsi_room_name: null,
        cancelled_by: null,
        cancellation_reason: null,
        teacher_notes: null,
      })
      .select('id, price, scheduled_at, duration_minutes, status')
      .single()

    if (insertError) {
      console.error('Ошибка создания урока:', insertError)
      // 23505 unique_violation / 23P01 exclusion_violation — оба означают конфликт слота
      if (insertError.code === '23505' || insertError.code === '23P01') {
        return NextResponse.json(
          { error: 'Выбранное время уже занято. Пожалуйста, выберите другой слот.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Ошибка создания урока' },
        { status: 500 }
      )
    }

    // Имя комнаты Jitsi по DB-сгенерированному id
    const jitsiRoomName = `speakflow-${lesson.id}`
    await supabase
      .from('lessons')
      .update({ jitsi_room_name: jitsiRoomName })
      .eq('id', lesson.id)

    return NextResponse.json({
      lessonId: lesson.id,
      price: lesson.price,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в teacher-create API:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
