// @ts-nocheck
// POST /api/trial-lesson/request
// Called after signup (when there's already a session — e.g. on the dashboard).
// Creates a trial_lesson_requests row, auto-assigns a teacher when a slot is
// provided, and notifies admins via Telegram. Idempotent.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { autoAssignTrial } from '@/lib/trial-lesson/auto-assign'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { verifyTurnstile } from '@/lib/api/turnstile'
import { protectPublic, validateEmailField } from '@/lib/api/arcjet'
import { invalidateStudentDashboard } from '@/lib/cache/invalidate'

const bodySchema = z.object({
  levelTestId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  preferredSlot: z
    .string()
    .datetime({ message: 'preferredSlot must be ISO datetime' })
    .optional(),
  teacherProfileId: z.string().uuid().optional(),
  turnstileToken: z.string().nullable().optional(),
  // Опциональный email — если фронт хочет, чтобы мы проверили адрес
  // отдельно (например, гостевая запись на пробный в будущем).
  email: z.string().trim().email().max(254).optional(),
})

export async function POST(request: Request) {
  // Arcjet FIRST — shield + bot detection до Supabase round-trip.
  const ajDeny = await protectPublic(request as any)
  if (ajDeny) return ajDeny

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  // Студент не должен спамить trial-запросами: 3 запроса в час
  // (auto-assign триггерит Telegram + поиск преподавателя — дорогая
  // операция). fail-closed: trial-воронка важна, но flood недопустим.
  // NextRequest нужен только для headers — оборачиваем Request.
  const limited = await enforceRateLimitStrict(request as any, {
    name: 'trial-lesson:request',
    keyParts: [user.id, getClientIp(request as any)],
    max: 3,
    windowSeconds: 60 * 60,
  })
  if (limited) return limited

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

  // CAPTCHA: пропускаем если TURNSTILE_SECRET_KEY не задан.
  const cap = await verifyTurnstile(parsed.data.turnstileToken, getClientIp(request as any))
  if (!cap.ok) {
    return NextResponse.json({ error: 'Проверка не пройдена' }, { status: 400 })
  }

  // Email-валидация (если фронт прислал поле email).
  if (parsed.data.email) {
    const emailCheck = await validateEmailField(parsed.data.email)
    if (!emailCheck.valid) {
      const msg =
        emailCheck.reason === 'disposable'
          ? 'Укажите личный email, а не одноразовый'
          : emailCheck.reason === 'no_mx'
            ? 'Домен этого email не принимает почту'
            : 'Некорректный email'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
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

  // Dashboard snapshot включает trial_request — заявка должна сразу
  // появиться у пользователя (TrialBookingCard + кнопка «Записан»).
  invalidateStudentDashboard(user.id)

  return NextResponse.json({
    id: result.requestId,
    reused: result.reused,
    status: result.status,
    lessonId: result.lessonId,
    teacherUserId: result.teacherUserId,
  })
}
