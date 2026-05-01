// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bookingSchema } from '@/lib/validations'
import { notifyLessonBooked } from '@/lib/notifications/booking'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const parsed = bookingSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { teacherId, scheduledAt, durationMinutes } = parsed.data

    const supabase = await createClient()

    // Verify user is authenticated
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

    // Verify user has student role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Профиль пользователя не найден' },
        { status: 404 }
      )
    }

    if (profile.role !== 'student') {
      return NextResponse.json(
        { error: 'Только студенты могут бронировать уроки' },
        { status: 403 }
      )
    }

    // Pin-флаг: если фронт прислал pin=true, после успешной брони
    // сохраним слот в student_preferred_slots для рекуррентных
    // подсказок «записаться снова» на дашборде.
    const wantsPin: boolean = Boolean((body as any)?.pin)

    // Prevent booking in the past
    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Нельзя забронировать урок на прошедшее время' },
        { status: 400 }
      )
    }

    // Prevent booking more than 30 days ahead
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30)
    if (scheduledDate > maxDate) {
      return NextResponse.json(
        { error: 'Нельзя забронировать урок более чем на 30 дней вперёд' },
        { status: 400 }
      )
    }

    // Prevent student from booking with themselves (if they are also a teacher)
    if (teacherId === user.id) {
      return NextResponse.json(
        { error: 'Нельзя забронировать урок у самого себя' },
        { status: 400 }
      )
    }

    // Verify teacher exists and is active.
    // Client passes auth user_id; resolve to teacher_profiles.id for FK columns.
    const { data: teacherProfile, error: teacherError } = await supabase
      .from('teacher_profiles')
      .select('id, hourly_rate, trial_rate, is_listed, is_verified')
      .eq('user_id', teacherId)
      .single()

    if (teacherError || !teacherProfile) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    if (!teacherProfile.is_listed) {
      return NextResponse.json(
        { error: 'Преподаватель временно не принимает учеников' },
        { status: 400 }
      )
    }

    const teacherProfileId = teacherProfile.id

    // ─────────────────────────────────────────────────────────────────
    // RULE: один день — один преподаватель.
    // Если в этот же календарный день (Europe/Moscow) у ученика уже
    // есть активный урок с ДРУГИМ преподавателем — отклоняем.
    // К тому же преподу можно бронировать сколько угодно слотов.
    // ─────────────────────────────────────────────────────────────────
    {
      const dayMs = 24 * 60 * 60 * 1000
      // Окно «день в Москве» считаем грубо как ±12ч от слота — этого
      // достаточно для пересечения по UTC-датам в МСК (UTC+3),
      // потом фильтруем на стороне SQL по дате в Europe/Moscow.
      const minIso = new Date(scheduledDate.getTime() - dayMs).toISOString()
      const maxIso = new Date(scheduledDate.getTime() + dayMs).toISOString()
      const { data: dayLessons } = await supabase
        .from('lessons')
        .select('id, teacher_id, scheduled_at, status')
        .eq('student_id', user.id)
        .gte('scheduled_at', minIso)
        .lte('scheduled_at', maxIso)
        .in('status', ['booked', 'in_progress', 'completed', 'pending_payment'])

      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' })
      const slotDay = fmt.format(scheduledDate)
      const conflict = (dayLessons ?? []).find((l: any) => {
        if (!l.teacher_id || !l.scheduled_at) return false
        if (l.teacher_id === teacherProfileId) return false
        const lDay = fmt.format(new Date(l.scheduled_at))
        return lDay === slotDay
      })
      if (conflict) {
        // Достаём имя другого преподавателя для понятного сообщения.
        const { data: otherTp } = await supabase
          .from('teacher_profiles')
          .select('user_id')
          .eq('id', conflict.teacher_id)
          .maybeSingle()
        let otherName = ''
        if (otherTp?.user_id) {
          const { data: otherProf } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', otherTp.user_id)
            .maybeSingle()
          otherName = otherProf?.full_name ?? ''
        }
        const msg = otherName
          ? `В этот день у тебя уже урок с ${otherName}. Записаться можно только к одному преподавателю в день.`
          : 'В этот день у тебя уже урок с другим преподавателем. Записаться можно только к одному преподу в день.'
        return NextResponse.json({ error: msg }, { status: 409 })
      }
    }

    // Call is_slot_available() to prevent double-booking (atomic check).
    // p_teacher_id expects teacher_profiles.id (matches lessons.teacher_id FK).
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

    // Calculate price based on duration
    // hourly_rate is stored in kopeks (based on transform in validation)
    // For 25 min: hourly_rate * 25/60, for 50 min: hourly_rate * 50/60
    const hourlyRate = teacherProfile.hourly_rate

    // Check if student is eligible for trial rate
    let price: number
    if (teacherProfile.trial_rate !== null) {
      const { count: previousLessons } = await supabase
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .eq('teacher_id', teacherProfileId)
        .in('status', ['booked', 'completed', 'in_progress'])

      if (previousLessons === 0) {
        // First lesson with this teacher - apply trial rate
        price = Math.round(
          (teacherProfile.trial_rate * durationMinutes) / 60
        )
      } else {
        price = Math.round((hourlyRate * durationMinutes) / 60)
      }
    } else {
      price = Math.round((hourlyRate * durationMinutes) / 60)
    }

    // TEMP: пока нет интеграции Yookassa — создаём урок сразу как booked с price=0.
    // Когда платёжка заработает, вернуть status='pending_payment' и price.
    const { data: lesson, error: insertError } = await supabase
      .from('lessons')
      .insert({
        student_id: user.id,
        teacher_id: teacherProfileId,
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        status: 'booked',
        price: 0,
        jitsi_room_name: null,
        cancelled_by: null,
        cancellation_reason: null,
        teacher_notes: null,
      })
      .select('id, price, scheduled_at, duration_minutes, status')
      .single()

    if (insertError) {
      console.error('[booking/create] lessons INSERT failed', {
        message: insertError.message,
        code: (insertError as any)?.code,
        details: (insertError as any)?.details,
        hint: (insertError as any)?.hint,
        teacherProfileId,
        scheduledAt,
      })

      const code = (insertError as any)?.code
      // 23505 = unique_violation, 23P01 = exclusion_violation (lessons_no_overlap GiST)
      if (code === '23505' || code === '23P01') {
        return NextResponse.json(
          { error: 'Это время уже забронировано у преподавателя. Пожалуйста, выберите другой слот.' },
          { status: 409 }
        )
      }
      // 23514 = check_violation, 23503 = fk_violation — отдаём как 400 с подсказкой
      if (code === '23514' || code === '23503') {
        return NextResponse.json(
          { error: 'Не удалось создать урок: некорректные данные. Попробуйте другой слот.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Не удалось создать урок (' + (insertError.message ?? 'неизвестная ошибка') + ')' },
        { status: 500 }
      )
    }

    // Set Jitsi room name using the DB-generated lesson ID
    const jitsiRoomName = `speakflow-${lesson.id}`
    await supabase
      .from('lessons')
      .update({ jitsi_room_name: jitsiRoomName })
      .eq('id', lesson.id)

    void notifyLessonBooked({ lessonId: lesson.id }).catch(() => {})

    // Закрепляем слот, если ученик попросил.
    if (wantsPin) {
      const moscow = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      })
        .formatToParts(scheduledDate)
      const wd = moscow.find((p) => p.type === 'weekday')?.value
      const hh = parseInt(moscow.find((p) => p.type === 'hour')?.value ?? '0', 10)
      const mm = parseInt(moscow.find((p) => p.type === 'minute')?.value ?? '0', 10)
      const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
      const weekday = wd ? wdMap[wd] ?? null : null
      if (weekday !== null && Number.isFinite(hh)) {
        await supabase
          .from('student_preferred_slots')
          .upsert(
            {
              student_id: user.id,
              teacher_id: teacherProfileId,
              weekday,
              hour: hh,
              minute: mm,
              duration_minutes: durationMinutes,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'student_id,weekday,hour,minute,teacher_id' }
          )
      }
    }

    return NextResponse.json({
      lessonId: lesson.id,
      price: lesson.price,
      redirectUrl: `/student/schedule`,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в create API:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
