// ---------------------------------------------------------------------------
// POST /api/lesson-request/cancel
//
// Студент отменяет свою же pending-заявку (revert-таймер в модалке).
// Тело: { requestId: uuid }
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateTeacherDashboard } from '@/lib/cache/invalidate'

const bodySchema = z.object({
  requestId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ошибка валидации' }, { status: 400 })
    }
    const { requestId } = parsed.data

    const admin = createAdminClient() as any

    // Owner + status pending check в самом update-е (RLS + status guard).
    const updRes = await admin
      .from('lesson_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('student_id', user.id)
      .eq('status', 'pending')
      .select('id, teacher_id')
      .maybeSingle()
    if (updRes.error) {
      return NextResponse.json({ error: updRes.error.message }, { status: 500 })
    }
    if (!updRes.data) {
      return NextResponse.json(
        { error: 'Заявка не найдена или уже обработана' },
        { status: 404 }
      )
    }

    // Инвалидируем teacher dashboard — бейдж уменьшится.
    // teacher_id в lesson_requests это teacher_profiles.id; резолвим в user_id.
    const teacherProfileId = updRes.data.teacher_id as string
    const { data: tp } = await admin
      .from('teacher_profiles')
      .select('user_id')
      .eq('id', teacherProfileId)
      .maybeSingle()
    if (tp?.user_id) invalidateTeacherDashboard(tp.user_id as string)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[lesson-request/cancel] Unexpected error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
