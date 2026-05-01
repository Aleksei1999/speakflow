// @ts-nocheck
// POST /api/trial-lesson/request
// Called after signup (when there's already a session — e.g. on the dashboard).
// Creates a trial_lesson_requests row, auto-assigns a teacher when a slot is
// provided, and notifies admins via Telegram. Idempotent.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { autoAssignTrial } from '@/lib/trial-lesson/auto-assign'

const bodySchema = z.object({
  levelTestId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  preferredSlot: z
    .string()
    .datetime({ message: 'preferredSlot must be ISO datetime' })
    .optional(),
  teacherProfileId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
  }

  const result = await autoAssignTrial({
    userId: user.id,
    preferredSlot: parsed.data.preferredSlot ?? null,
    notes: parsed.data.notes ?? null,
    levelTestId: parsed.data.levelTestId ?? null,
    teacherProfileId: parsed.data.teacherProfileId ?? null,
  })

  if (!result) {
    return NextResponse.json({ error: 'Не удалось создать заявку' }, { status: 500 })
  }

  return NextResponse.json({
    id: result.requestId,
    reused: result.reused,
    status: result.status,
    lessonId: result.lessonId,
    teacherUserId: result.teacherUserId,
  })
}
