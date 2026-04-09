// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

/**
 * Cron-джоб: напоминания об уроках.
 *
 * Запускается каждые 15 минут через Vercel Cron.
 * Находит уроки, начинающиеся через 55-65 минут, и отправляет
 * напоминания обоим участникам (студент + преподаватель).
 *
 * Окно в 10 минут (55-65) обеспечивает, что при интервале cron в 15 минут
 * каждый урок получит ровно одно напоминание.
 */

export async function GET(request: NextRequest) {
  // Проверяем CRON_SECRET для защиты от несанкционированных вызовов
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = createAdminClient()

  try {
    const now = new Date()
    const from = new Date(now.getTime() + 55 * 60 * 1000) // +55 минут
    const to = new Date(now.getTime() + 65 * 60 * 1000)   // +65 минут

    // Находим уроки в окне напоминания
    const { data: lessons, error: queryError } = await supabase
      .from('lessons')
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        student_id,
        teacher_id,
        jitsi_room_name
      `)
      .eq('status', 'booked')
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())

    if (queryError) {
      console.error('[cron/lesson-reminders] Ошибка запроса уроков:', queryError)
      return NextResponse.json(
        { error: 'Ошибка запроса уроков' },
        { status: 500 }
      )
    }

    if (!lessons || lessons.length === 0) {
      return NextResponse.json({
        status: 'ok',
        remindersCount: 0,
        message: 'Нет уроков для напоминания',
      })
    }

    // Собираем уникальные ID пользователей
    const userIds = new Set<string>()
    for (const lesson of lessons) {
      userIds.add(lesson.student_id)
      userIds.add(lesson.teacher_id)
    }

    // Получаем профили всех участников одним запросом
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(userIds))

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    )

    let remindersCount = 0
    const errors: string[] = []

    for (const lesson of lessons) {
      const scheduledDate = new Date(lesson.scheduled_at)
      const dateStr = format(scheduledDate, 'd MMMM yyyy', { locale: ru })
      const timeStr = format(scheduledDate, 'HH:mm', { locale: ru })

      const studentProfile = profileMap.get(lesson.student_id)
      const teacherProfile = profileMap.get(lesson.teacher_id)

      const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/lesson/${lesson.id}`

      // Напоминание студенту
      if (studentProfile) {
        try {
          await sendNotification(lesson.student_id, 'lesson_reminder', {
            name: studentProfile.full_name,
            teacherOrStudentName: teacherProfile?.full_name || 'Преподаватель',
            date: dateStr,
            time: timeStr,
            joinUrl,
          })
          remindersCount++
        } catch (err) {
          const msg = `Ошибка напоминания студенту ${lesson.student_id}: ${err}`
          console.error(`[cron/lesson-reminders] ${msg}`)
          errors.push(msg)
        }
      }

      // Напоминание преподавателю
      if (teacherProfile) {
        try {
          await sendNotification(lesson.teacher_id, 'lesson_reminder', {
            name: teacherProfile.full_name,
            teacherOrStudentName: studentProfile?.full_name || 'Студент',
            date: dateStr,
            time: timeStr,
            joinUrl,
          })
          remindersCount++
        } catch (err) {
          const msg = `Ошибка напоминания преподавателю ${lesson.teacher_id}: ${err}`
          console.error(`[cron/lesson-reminders] ${msg}`)
          errors.push(msg)
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      lessonsFound: lessons.length,
      remindersCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[cron/lesson-reminders] Непредвиденная ошибка:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
