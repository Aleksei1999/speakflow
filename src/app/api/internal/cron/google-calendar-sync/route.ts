// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listEvents } from '@/lib/google-calendar/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron: Google → Speakflow one-way sync (manual events).
 *
 * Каждые 15 минут для каждого teacher-а с подключённым Google Calendar:
 *   1) Тянет события [-1d..+30d].
 *   2) Пропускает то, что мы САМИ создали (extendedProps.private.source='raw-english').
 *   3) Для оставшегося ищет ученика по email в attendees.
 *   4) Если нашёл — INSERT/UPDATE в `lessons` c google_event_id=event.id,
 *      status='booked', price=0.
 *
 * Идемпотентно: по совпадению `lessons.google_event_id` = event.id либо
 * не INSERT-ит, либо UPDATE-ит scheduled_at/duration.
 *
 * Fail-soft: ошибка одного учителя не блокирует остальных.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = Date.now()
  const from = new Date(now - 24 * 60 * 60 * 1000) // -1d
  const to = new Date(now + 30 * 24 * 60 * 60 * 1000) // +30d

  // 1) Список всех подключённых Google-аккаунтов + role/teacher_profiles.id.
  const { data: tokens, error: tokErr } = await admin
    .from('google_calendar_tokens')
    .select('user_id')
  if (tokErr) {
    console.error('[cron/gcal-sync] tokens fetch failed', tokErr)
    return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 })
  }
  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ ok: true, teachers: 0, imported: 0, updated: 0 })
  }

  const userIds = tokens.map((t: any) => t.user_id)
  const { data: teacherProfiles } = await admin
    .from('teacher_profiles')
    .select('id, user_id')
    .in('user_id', userIds)
  const teacherIdByUser = new Map<string, string>(
    ((teacherProfiles as any[]) || []).map((p) => [p.user_id, p.id]),
  )

  let imported = 0
  let updated = 0
  let processedTeachers = 0
  const errors: string[] = []

  for (const t of tokens as any[]) {
    const teacherUserId = t.user_id
    const teacherProfileId = teacherIdByUser.get(teacherUserId)
    if (!teacherProfileId) continue // не teacher — не пушим в lessons

    processedTeachers++

    let events: Awaited<ReturnType<typeof listEvents>> = []
    try {
      events = await listEvents(teacherUserId, from, to)
    } catch (e) {
      const msg = `list teacher=${teacherUserId}: ${e instanceof Error ? e.message : String(e)}`
      console.error('[cron/gcal-sync]', msg)
      errors.push(msg)
      continue
    }

    // Кандидаты: event имеет dateTime start и НЕ создан нами.
    const candidates = events.filter((e) => {
      if (!e.id || !e.start?.dateTime || !e.end?.dateTime) return false
      const src = e.extendedProperties?.private?.source
      if (src === 'raw-english') return false
      return true
    })
    if (candidates.length === 0) continue

    // Собираем уникальные email attendees для batch-lookup ученика.
    const emails = new Set<string>()
    for (const e of candidates) {
      for (const a of e.attendees ?? []) {
        if (a.email) emails.add(a.email.toLowerCase())
      }
    }
    if (emails.size === 0) continue

    const { data: studentRows } = await admin
      .from('profiles')
      .select('id, email, role')
      .in('email', Array.from(emails))
      .eq('role', 'student')
    const studentByEmail = new Map<string, string>(
      ((studentRows as any[]) || []).map((p) => [String(p.email).toLowerCase(), p.id]),
    )

    // Batch-lookup существующих lessons по google_event_id.
    const eventIds = candidates.map((e) => e.id)
    const { data: existingRows } = await admin
      .from('lessons')
      .select('id, google_event_id, scheduled_at, duration_minutes')
      .in('google_event_id', eventIds)
    const existingByGid = new Map<string, any>(
      ((existingRows as any[]) || []).map((l) => [l.google_event_id, l]),
    )

    for (const ev of candidates) {
      // Ищем ученика среди attendees.
      let studentId: string | null = null
      for (const a of ev.attendees ?? []) {
        if (!a.email) continue
        const sid = studentByEmail.get(a.email.toLowerCase())
        if (sid) {
          studentId = sid
          break
        }
      }
      if (!studentId) continue

      const startISO = ev.start!.dateTime!
      const endISO = ev.end!.dateTime!
      const durationMinutes = Math.max(
        1,
        Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60_000),
      )

      const existing = existingByGid.get(ev.id)
      if (existing) {
        // UPDATE если время/длительность изменились.
        if (
          existing.scheduled_at !== startISO ||
          existing.duration_minutes !== durationMinutes
        ) {
          const { error: updErr } = await (admin.from('lessons') as any)
            .update({ scheduled_at: startISO, duration_minutes: durationMinutes })
            .eq('id', existing.id)
          if (updErr) {
            errors.push(`update ${existing.id}: ${updErr.message}`)
          } else {
            updated++
          }
        }
      } else {
        // INSERT.
        const { error: insErr } = await (admin.from('lessons') as any)
          .insert({
            student_id: studentId,
            teacher_id: teacherProfileId,
            scheduled_at: startISO,
            duration_minutes: durationMinutes,
            status: 'booked',
            price: 0,
            google_event_id: ev.id,
            jitsi_room_name: null,
            cancelled_by: null,
            cancellation_reason: null,
            teacher_notes: null,
          })
        if (insErr) {
          // 23P01 exclusion_violation → уже есть урок на этот слот, пропускаем
          if ((insErr as any).code === '23P01' || (insErr as any).code === '23505') {
            continue
          }
          errors.push(`insert gid=${ev.id}: ${insErr.message}`)
        } else {
          imported++
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    teachers: processedTeachers,
    imported,
    updated,
    errors: errors.length ? errors : undefined,
  })
}
