// ---------------------------------------------------------------------------
// POST /api/lesson-request/create
//
// Студент отправляет учителю заявку на урок в конкретное время.
//   • Проверяем что слот свободен: lessons + Google Calendar учителя (fail-soft).
//   • НЕ создаём lessons. Создаём lesson_requests(status='pending').
//   • Учитель видит в модалке «запрос на урок», при accept — уже createLesson.
//
// Тело: { teacherId: uuid (teacher.user_id), scheduledAt: iso, message?: string }
// Response: { requestId, status: 'pending' } или { error, code? }
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasGoogleCalendar, isSlotBusyInGoogle } from '@/lib/google-calendar/client'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { invalidateTeacherDashboard } from '@/lib/cache/invalidate'
import { logAuditEvent } from '@/lib/audit/log'

const DEFAULT_DURATION_MIN = 50

const bodySchema = z.object({
  teacherId: z.string().uuid('Некорректный ID преподавателя'),
  scheduledAt: z.string().datetime('Некорректный формат даты'),
  message: z.string().trim().max(500).optional().nullable(),
})

const BUSY_LESSON_STATUSES = ['booked', 'in_progress', 'scheduled', 'confirmed'] as const

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
    }

    // Rate-limit: 10/мин на юзера. Уровень как у booking/create.
    const limited = await enforceRateLimitStrict(request, {
      name: 'lesson-request:create',
      keyParts: [user.id, getClientIp(request)],
      max: 10,
      windowSeconds: 60,
    })
    if (limited) return limited

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Ошибка валидации' },
        { status: 400 }
      )
    }

    const { teacherId, scheduledAt, message } = parsed.data
    const startMs = Date.parse(scheduledAt)
    if (!Number.isFinite(startMs) || startMs <= Date.now()) {
      return NextResponse.json(
        { error: 'Нельзя запросить урок на прошедшее время' },
        { status: 400 }
      )
    }
    const endMs = startMs + DEFAULT_DURATION_MIN * 60_000
    const startISO = new Date(startMs).toISOString()
    const endISO = new Date(endMs).toISOString()

    // Проверка роли — только студент.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.role !== 'student') {
      return NextResponse.json(
        { error: 'Только студенты могут отправлять заявки на урок' },
        { status: 403 }
      )
    }
    if (teacherId === user.id) {
      return NextResponse.json({ error: 'Нельзя оставить заявку самому себе' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Resolve teacher_profiles.id + verify listed.
    const tpRes = await admin
      .from('teacher_profiles')
      .select('id, is_listed')
      .eq('user_id', teacherId)
      .maybeSingle()
    if (tpRes.error || !tpRes.data) {
      return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 404 })
    }
    if (!tpRes.data.is_listed) {
      return NextResponse.json(
        { error: 'Преподаватель временно не принимает заявки' },
        { status: 400 }
      )
    }
    const teacherProfileId = tpRes.data.id as string

    // Дубликат: у студента уже есть pending-запрос к этому учителю на то же время.
    const dupRes = await admin
      .from('lesson_requests')
      .select('id')
      .eq('student_id', user.id)
      .eq('teacher_id', teacherProfileId)
      .eq('requested_at', startISO)
      .eq('status', 'pending')
      .maybeSingle()
    if (dupRes.data?.id) {
      return NextResponse.json({
        requestId: dupRes.data.id as string,
        status: 'pending',
        reused: true,
      })
    }

    // Slot busy: другой активный урок этого учителя пересекается с [start,end).
    const windowFromISO = new Date(startMs - DEFAULT_DURATION_MIN * 60_000).toISOString()
    const windowToISO = new Date(endMs + DEFAULT_DURATION_MIN * 60_000).toISOString()
    const busyRes = await admin
      .from('lessons')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('teacher_id', teacherProfileId)
      .in('status', BUSY_LESSON_STATUSES as unknown as string[])
      .gte('scheduled_at', windowFromISO)
      .lte('scheduled_at', windowToISO)
    if (busyRes.error) {
      return NextResponse.json({ error: 'Ошибка проверки слота' }, { status: 500 })
    }
    for (const r of (busyRes.data ?? []) as Array<{
      scheduled_at: string
      duration_minutes: number | null
    }>) {
      const s = Date.parse(r.scheduled_at)
      if (!Number.isFinite(s)) continue
      const dur = typeof r.duration_minutes === 'number' && r.duration_minutes > 0
        ? r.duration_minutes
        : DEFAULT_DURATION_MIN
      const e = s + dur * 60_000
      if (s < endMs && e > startMs) {
        return NextResponse.json(
          { error: 'В это время у преподавателя уже есть урок', code: 'slot_busy_lessons' },
          { status: 409 }
        )
      }
    }

    // Google Calendar busy — только если у учителя подключён.
    // Fail-soft внутри isSlotBusyInGoogle: сетевые ошибки → false, не блокируем.
    const conn = await hasGoogleCalendar(teacherId)
    if (conn.connected) {
      const gBusy = await isSlotBusyInGoogle(teacherId, startISO, endISO)
      if (gBusy) {
        return NextResponse.json(
          {
            error: 'В это время в Google Calendar преподавателя уже есть событие',
            code: 'slot_busy_google',
          },
          { status: 409 }
        )
      }
    }

    // INSERT lesson_requests.
    const insRes = await admin
      .from('lesson_requests')
      .insert({
        student_id: user.id,
        teacher_id: teacherProfileId,
        requested_at: startISO,
        status: 'pending',
        message: message ?? null,
      })
      .select('id')
      .single()
    if (insRes.error || !insRes.data) {
      console.error('[lesson-request/create] insert failed', insRes.error)
      return NextResponse.json({ error: 'Не удалось создать заявку' }, { status: 500 })
    }
    const requestId = insRes.data.id as string

    // Учитель должен увидеть бейдж «запрос на урок» → инвалидируем его снапшот.
    invalidateTeacherDashboard(teacherId)

    await logAuditEvent(request, {
      category: 'data',
      action: 'lesson_request_created',
      target_type: 'lesson_requests',
      target_id: requestId,
      payload: {
        student_id: user.id,
        teacher_id: teacherProfileId,
        requested_at: startISO,
      },
    })

    return NextResponse.json({ requestId, status: 'pending' as const })
  } catch (e) {
    console.error('[lesson-request/create] Unexpected error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
