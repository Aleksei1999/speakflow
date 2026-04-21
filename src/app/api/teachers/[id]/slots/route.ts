// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'

// Mirror of the slot algorithm from src/app/api/booking/slots/route.ts:
// 50-minute duration, 25-minute granularity cursor, 5-minute buffer, subtract
// booked/in_progress lessons from teacher_availability windows.
const SLOT_DURATION_MINUTES = 50
const SLOT_STEP_MINUTES = 25
const BUFFER_MINUTES = 5

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
  limit: z.coerce.number().int().min(1).max(50).default(8),
})

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teacherProfileId } = await params

    if (!UUID_REGEX.test(teacherProfileId)) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      days: searchParams.get('days') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Некорректные параметры' },
        { status: 400 }
      )
    }
    const { days, limit } = parsed.data

    // Verify teacher exists and is listed.
    const { data: teacher, error: teacherErr } = await supabase
      .from('teacher_profiles')
      .select('id, is_listed')
      .eq('id', teacherProfileId)
      .maybeSingle()

    if (teacherErr) {
      console.error('Ошибка загрузки преподавателя:', teacherErr)
      return NextResponse.json(
        { error: 'Не удалось загрузить преподавателя' },
        { status: 500 }
      )
    }
    if (!teacher || !teacher.is_listed) {
      return NextResponse.json(
        { error: 'Преподаватель не найден' },
        { status: 404 }
      )
    }

    // Fetch weekly availability (all days).
    const { data: availability, error: availErr } = await supabase
      .from('teacher_availability')
      .select('day_of_week, start_time, end_time')
      .eq('teacher_id', teacherProfileId)
      .eq('is_active', true)

    if (availErr || !availability || availability.length === 0) {
      // Any failure or empty availability -> return empty slots (spec).
      return NextResponse.json({ slots: [] })
    }

    // Group windows by day_of_week for O(1) lookup per day.
    const byDow: Record<number, Array<{ start: number; end: number }>> = {}
    for (const w of availability) {
      const dow = w.day_of_week as number
      const start = timeToMinutes(w.start_time as string)
      const end = timeToMinutes(w.end_time as string)
      if (!byDow[dow]) byDow[dow] = []
      byDow[dow].push({ start, end })
    }

    // Range in UTC: from now → now + days.
    const now = new Date()
    const rangeStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    )
    const rangeEnd = new Date(rangeStart.getTime() + days * 24 * 60 * 60 * 1000)

    // Fetch all booked / in_progress lessons in the range.
    const { data: lessons, error: lessonsErr } = await supabase
      .from('lessons')
      .select('scheduled_at, duration_minutes')
      .eq('teacher_id', teacherProfileId)
      .gte('scheduled_at', rangeStart.toISOString())
      .lt('scheduled_at', rangeEnd.toISOString())
      .in('status', ['pending_payment', 'booked', 'in_progress'])

    if (lessonsErr) {
      console.error('Ошибка загрузки уроков:', lessonsErr)
      return NextResponse.json({ slots: [] })
    }

    // Bucket booked ranges by date string 'YYYY-MM-DD' (UTC).
    const bookedByDate: Record<string, Array<{ start: number; end: number }>> = {}
    for (const l of lessons || []) {
      const d = new Date(l.scheduled_at as string)
      const dateKey = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
      const startMin = d.getUTCHours() * 60 + d.getUTCMinutes()
      const endMin = startMin + ((l.duration_minutes as number) ?? SLOT_DURATION_MINUTES)
      if (!bookedByDate[dateKey]) bookedByDate[dateKey] = []
      bookedByDate[dateKey].push({ start: startMin, end: endMin })
    }

    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    const todayKey = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`

    const slots: Array<{
      starts_at: string
      ends_at: string
      day_label: string
      time_label: string
    }> = []

    // Iterate day-by-day, generating slots and filtering.
    for (let dayOffset = 0; dayOffset < days && slots.length < limit; dayOffset += 1) {
      const day = new Date(rangeStart.getTime() + dayOffset * 24 * 60 * 60 * 1000)
      const dow = day.getUTCDay() // 0 = Sunday, matches DB encoding.
      const windows = byDow[dow]
      if (!windows || windows.length === 0) continue

      const dateKey = `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`
      const booked = bookedByDate[dateKey] ?? []
      const isToday = dateKey === todayKey

      // Sort windows by start to get stable chronological output.
      const sortedWindows = [...windows].sort((a, b) => a.start - b.start)

      for (const w of sortedWindows) {
        for (
          let start = w.start;
          start + SLOT_DURATION_MINUTES <= w.end;
          start += SLOT_STEP_MINUTES
        ) {
          const end = start + SLOT_DURATION_MINUTES

          // Drop past slots for today.
          if (isToday && start <= nowMin) continue

          // Skip if overlaps booked range (±buffer).
          const blocked = booked.some((b) => {
            const bStart = b.start - BUFFER_MINUTES
            const bEnd = b.end + BUFFER_MINUTES
            return start < bEnd && end > bStart
          })
          if (blocked) continue

          const sh = Math.floor(start / 60)
          const sm = start % 60
          const eh = Math.floor(end / 60)
          const em = end % 60

          const startsAtISO = `${dateKey}T${pad2(sh)}:${pad2(sm)}:00Z`
          const endsAtISO = `${dateKey}T${pad2(eh)}:${pad2(em)}:00Z`

          slots.push({
            starts_at: startsAtISO,
            ends_at: endsAtISO,
            day_label: format(day, 'EE, d MMM', { locale: ru }),
            time_label: `${pad2(sh)}:${pad2(sm)}`,
          })

          if (slots.length >= limit) break
        }
        if (slots.length >= limit) break
      }
    }

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Непредвиденная ошибка в /api/teachers/[id]/slots:', error)
    // Never 500 on slot failures (spec).
    return NextResponse.json({ slots: [] })
  }
}
