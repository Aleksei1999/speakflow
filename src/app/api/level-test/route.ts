// Save a pre-computed quiz result (from the landing-page popup) to level_tests,
// linking it to the freshly-signed-up user.

import type { NextRequest } from 'next/server'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { applyTestLevel } from '@/lib/levels/apply-test-level'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const RAW_LEVEL_MAP: Record<string, string> = {
  raw: 'Raw',
  rare: 'Rare',
  mediumrare: 'Medium Rare',
  medium: 'Medium',
  mediumwell: 'Medium Well',
  welldone: 'Well Done',
}

const quizResultSchema = z.object({
  level: z.enum(['raw', 'rare', 'mediumrare', 'medium', 'mediumwell', 'welldone']),
  levelName: z.string().optional(),
  xp: z.number().int().min(0).max(10000),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  percent: z.number().min(0).max(100).optional(),
  answers: z.record(z.union([z.string(), z.number()]), z.number()).optional(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const parsed = quizResultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Некорректные данные', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const limited = await enforceRateLimitStrict(request as NextRequest, {
    name: 'api:level-test',
    keyParts: [user.id, getClientIp(request as NextRequest)],
    max: 5,
    windowSeconds: 60,
  })
  if (limited) return limited
  const levelDb = RAW_LEVEL_MAP[parsed.data.level]
  if (!levelDb) {
    return NextResponse.json({ error: 'Неизвестный уровень' }, { status: 400 })
  }

  // FIXME(types): level_tests Insert in Database type lacks total_questions/xp columns
  const { data, error } = (await (supabase.from('level_tests') as any)
    .insert({
      user_id: user?.id ?? null,
      score: parsed.data.correctCount,
      total_questions: parsed.data.totalQuestions,
      xp: parsed.data.xp,
      level: levelDb,
      answers: parsed.data.answers ?? {},
    })
    .select('id')
    .single()) as { data: { id: string } | null; error: any }

  if (error) {
    console.error('[level-test] insert failed:', error)
    return NextResponse.json({ error: 'Не удалось сохранить результат' }, { status: 500 })
  }

  // Sync english_level onto user_progress for students
  // user_progress не имеет UPDATE-политики для пользователя → пишем service-role.
  await applyTestLevel(user.id, levelDb)

  return NextResponse.json({ id: data?.id, level: levelDb })
}
