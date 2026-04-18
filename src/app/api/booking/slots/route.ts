// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SLOT_DURATIONS = [25, 50] as const
const BUFFER_MINUTES = 5

interface TimeSlot {
  startTime: string
  endTime: string
  available: boolean
}

interface AvailabilityWindow {
  startTime: string
  endTime: string
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr)
  return hours * 60 + minutes
}

function generateSlotsFromWindow(
  date: string,
  window: AvailabilityWindow,
  durationMinutes: number,
  bookedRanges: Array<{ start: number; end: number }>
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const windowStart = timeToMinutes(window.startTime)
  const windowEnd = timeToMinutes(window.endTime)

  for (let start = windowStart; start + durationMinutes <= windowEnd; start += 25) {
    const end = start + durationMinutes
    const startHours = Math.floor(start / 60)
    const startMins = start % 60
    const endHours = Math.floor(end / 60)
    const endMins = end % 60

    const startISO = `${date}T${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}:00Z`
    const endISO = `${date}T${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00Z`

    // Check overlap with booked ranges (including buffer)
    const isBlocked = bookedRanges.some((booked) => {
      const bookedStartWithBuffer = booked.start - BUFFER_MINUTES
      const bookedEndWithBuffer = booked.end + BUFFER_MINUTES
      return start < bookedEndWithBuffer && end > bookedStartWithBuffer
    })

    slots.push({
      startTime: startISO,
      endTime: endISO,
      available: !isBlocked,
    })
  }

  return slots
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacherId')
    const date = searchParams.get('date')
    const duration = searchParams.get('duration')

    if (!teacherId || !date) {
      return NextResponse.json(
        { error: 'Параметры teacherId и date обязательны' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(teacherId)) {
      return NextResponse.json(
        { error: 'Некорректный формат teacherId' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Некорректный формат даты. Ожидается YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Reject past dates
    const requestedDate = new Date(date + 'T00:00:00Z')
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (requestedDate < today) {
      return NextResponse.json(
        { error: 'Нельзя просматривать слоты на прошедшие даты' },
        { status: 400 }
      )
    }

    const durationMinutes = duration ? parseInt(duration, 10) : null
    if (durationMinutes !== null && durationMinutes !== 25 && durationMinutes !== 50) {
      return NextResponse.json(
        { error: 'Длительность должна быть 25 или 50 минут' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // teacherId (from client) is auth user_id — resolve to teacher_profiles.id
    // which is the FK target used in teacher_availability.teacher_id and lessons.teacher_id.
    const { data: teacherProfile, error: profileError } = await supabase
      .from('teacher_profiles')
      .select('id, hourly_rate, trial_rate')
      .eq('user_id', teacherId)
      .single()

    if (profileError || !teacherProfile) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const teacherProfileId = teacherProfile.id

    // Get day_of_week: JS getUTCDay() returns 0=Sunday, DB expects 0=Sunday
    const dayOfWeek = requestedDate.getUTCDay()

    // Fetch teacher availability for this day of week
    const { data: availability, error: availError } = await supabase
      .from('teacher_availability')
      .select('start_time, end_time')
      .eq('teacher_id', teacherProfileId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)

    if (availError) {
      console.error('Ошибка загрузки расписания:', availError)
      return NextResponse.json(
        { error: 'Ошибка загрузки расписания преподавателя' },
        { status: 500 }
      )
    }

    if (!availability || availability.length === 0) {
      return NextResponse.json({
        slots: [],
        teacherRate: teacherProfile.hourly_rate,
        trialRate: teacherProfile.trial_rate,
      })
    }

    // Fetch existing booked/in_progress lessons for this date
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`

    const { data: existingLessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('scheduled_at, duration_minutes')
      .eq('teacher_id', teacherProfileId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .in('status', ['pending_payment', 'booked', 'in_progress'])

    if (lessonsError) {
      console.error('Ошибка загрузки уроков:', lessonsError)
      return NextResponse.json(
        { error: 'Ошибка загрузки существующих уроков' },
        { status: 500 }
      )
    }

    // Convert existing lessons to minute ranges
    const bookedRanges = (existingLessons || []).map((lesson) => {
      const lessonDate = new Date(lesson.scheduled_at)
      const startMinutes = lessonDate.getUTCHours() * 60 + lessonDate.getUTCMinutes()
      return {
        start: startMinutes,
        end: startMinutes + lesson.duration_minutes,
      }
    })

    // Filter out slots that are in the past for today
    const now = new Date()
    const isToday =
      requestedDate.getUTCFullYear() === now.getUTCFullYear() &&
      requestedDate.getUTCMonth() === now.getUTCMonth() &&
      requestedDate.getUTCDate() === now.getUTCDate()
    const currentMinutes = isToday
      ? now.getUTCHours() * 60 + now.getUTCMinutes()
      : -1

    // Generate slots for each availability window
    const durations = durationMinutes ? [durationMinutes] : SLOT_DURATIONS
    const allSlots: Record<number, TimeSlot[]> = {}

    for (const dur of durations) {
      const slotsForDuration: TimeSlot[] = []

      for (const window of availability) {
        const windowSlots = generateSlotsFromWindow(
          date,
          { startTime: window.start_time, endTime: window.end_time },
          dur,
          bookedRanges
        )
        slotsForDuration.push(...windowSlots)
      }

      // Mark past slots as unavailable
      if (isToday) {
        for (const slot of slotsForDuration) {
          const slotDate = new Date(slot.startTime)
          const slotMinutes = slotDate.getUTCHours() * 60 + slotDate.getUTCMinutes()
          if (slotMinutes <= currentMinutes) {
            slot.available = false
          }
        }
      }

      // Sort by start time
      slotsForDuration.sort((a, b) => a.startTime.localeCompare(b.startTime))

      allSlots[dur] = slotsForDuration
    }

    return NextResponse.json({
      slots: durationMinutes ? allSlots[durationMinutes] : allSlots,
      teacherRate: teacherProfile.hourly_rate,
      trialRate: teacherProfile.trial_rate,
    })
  } catch (error) {
    console.error('Непредвиденная ошибка в slots API:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
