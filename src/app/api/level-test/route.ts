// @ts-nocheck
// Save a pre-computed quiz result (from the landing-page popup) to level_tests,
// linking it to the freshly-signed-up user.

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { invalidateUserProgress } from '@/lib/cache/invalidate'

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

  const levelDb = RAW_LEVEL_MAP[parsed.data.level]
  if (!levelDb) {
    return NextResponse.json({ error: 'Неизвестный уровень' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('level_tests')
    .insert({
      user_id: user?.id ?? null,
      score: parsed.data.correctCount,
      total_questions: parsed.data.totalQuestions,
      xp: parsed.data.xp,
      level: levelDb,
      answers: parsed.data.answers ?? {},
    })
    .select('id')
    .single()

  if (error) {
    console.error('[level-test] insert failed:', error)
    return NextResponse.json({ error: 'Не удалось сохранить результат' }, { status: 500 })
  }

  // Sync english_level onto user_progress for students
  if (user?.id) {
    const { error: progressError } = await supabase
      .from('user_progress')
      .update({ english_level: levelDb })
      .eq('user_id', user.id)

    if (progressError) {
      console.error('[level-test] progress sync failed:', progressError)
    } else {
      invalidateUserProgress(user.id)
    }
  }

  return NextResponse.json({ id: data.id, level: levelDb })
}
