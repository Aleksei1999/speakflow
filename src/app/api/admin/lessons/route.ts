// POST /api/admin/lessons
// Админ создаёт урок для пары teacher+student в указанное время.
// Body: { teacher_id: teacher_profiles.id, student_id: profiles.id, scheduled_at: ISO, duration?: 50 }

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  invalidateTeacherStudents,
  invalidateTeacherDashboard,
  invalidateStudentDashboard,
} from '@/lib/cache/invalidate'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  teacher_id: z.string().uuid(),   // teacher_profiles.id
  student_id: z.string().uuid(),   // profiles.id
  scheduled_at: z.string().min(1),
  duration_minutes: z.number().int().min(15).max(240).optional(),
  price: z.number().int().min(0).max(1_000_000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    let body: unknown
    try { body = await request.json() } catch { body = null }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Bad body' }, { status: 400 })
    }
    const { teacher_id, student_id, scheduled_at, duration_minutes, price: priceInput } = parsed.data

    const startMs = Date.parse(scheduled_at)
    if (Number.isNaN(startMs)) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    const duration = duration_minutes ?? 50
    const startISO = new Date(startMs).toISOString()

    const admin = createAdminClient() as any

    // teacher_profile → user_id (для инвалидации кэша) + rate
    const { data: tp } = await admin
      .from('teacher_profiles')
      .select('id, user_id, hourly_rate')
      .eq('id', teacher_id)
      .maybeSingle()
    if (!tp?.id) return NextResponse.json({ error: 'Преподаватель не найден' }, { status: 400 })

    // Простая проверка занятости: любой урок этого преподавателя в окне [start-1h, start+1h]
    const windowFrom = new Date(startMs - 60 * 60_000).toISOString()
    const windowTo = new Date(startMs + duration * 60_000 + 60 * 60_000).toISOString()
    const { data: busy } = await admin
      .from('lessons')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('teacher_id', tp.id)
      .in('status', ['scheduled', 'confirmed', 'booked'])
      .gte('scheduled_at', windowFrom)
      .lte('scheduled_at', windowTo)
    const endMs = startMs + duration * 60_000
    for (const r of (busy ?? []) as any[]) {
      const s = Date.parse(r.scheduled_at)
      if (!Number.isFinite(s)) continue
      const e = s + (r.duration_minutes || 50) * 60_000
      if (s < endMs && e > startMs) {
        return NextResponse.json(
          { error: 'В это время у преподавателя уже есть урок', code: 'slot_busy' },
          { status: 409 },
        )
      }
    }

    // Приоритет: явно указанная админом цена > hourly_rate учителя > 0
    const price = typeof priceInput === 'number' && priceInput >= 0
      ? priceInput
      : (typeof tp.hourly_rate === 'number' && tp.hourly_rate > 0 ? tp.hourly_rate : 0)
    const { data: ins, error: insErr } = await admin
      .from('lessons')
      .insert({
        student_id,
        teacher_id: tp.id,
        scheduled_at: startISO,
        duration_minutes: duration,
        status: 'booked',
        price,
      })
      .select('id')
      .single()
    if (insErr || !ins?.id) {
      console.error('[admin/lessons][POST] insert', insErr)
      return NextResponse.json({ error: 'Не удалось создать урок' }, { status: 500 })
    }

    // Инвалидируем кэш обоих сторон
    invalidateTeacherStudents(tp.user_id)
    invalidateTeacherDashboard(tp.user_id)
    invalidateStudentDashboard(student_id)

    return NextResponse.json({ ok: true, id: ins.id })
  } catch (e) {
    console.error('[admin/lessons][POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
