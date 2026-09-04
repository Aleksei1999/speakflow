// ---------------------------------------------------------------------------
// POST /api/me/level-test/import
//
// Импортирует результат теста, пройденного на лендинге ДО регистрации.
// Клиент хранит его в localStorage['landingQuizResult'] и после signup
// шлёт сюда — мы создаём строку level_tests с user_id=me. Идемпотентно
// в пределах 24 часов, чтобы двойной вызов не плодил дубликаты.
//
// Тело: { answers: Record<string,unknown>, score: number, level: 'A1'..'C2', completedAt?: string }
//
// Возвращает: { id, created: boolean }  — created=false если найден свежий (в 24h) существующий.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { toRoastLevel } from '@/lib/levels/mapping'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const bodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  score: z.number().int().min(0).max(1000),
  level: z.enum(LEVELS),
  completedAt: z.string().datetime().optional(),
})

const DUP_WINDOW_HOURS = 24

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 })
    }

    // 5/min — импорт после signup вызывается один раз, флудить не за чем.
    const limited = await enforceRateLimitStrict(request, {
      name: 'level-test:import',
      keyParts: [user.id, getClientIp(request)],
      max: 5,
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

    const admin = createAdminClient() as any

    // Идемпотентность: если у юзера уже есть свежий (24h) level_test —
    // не создаём новый. Второй вызов с localStorage вернёт тот же id.
    const cutoff = new Date(Date.now() - DUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const { data: existing } = await admin
      .from('level_tests')
      .select('id')
      .eq('user_id', user.id)
      .gte('completed_at', cutoff)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing?.id) {
      return NextResponse.json({ id: existing.id as string, created: false })
    }

    const { data: inserted, error: insErr } = await admin
      .from('level_tests')
      .insert({
        user_id: user.id,
        email: user.email ?? null,
        answers: parsed.data.answers,
        score: parsed.data.score,
        // DB CHECK хранит роаст-уровни (Raw..Well Done) — миграция 011.
        level: toRoastLevel(parsed.data.level),
        completed_at: parsed.data.completedAt ?? new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      console.error('[level-test/import] insert failed', insErr)
      return NextResponse.json({ error: 'Не удалось сохранить тест' }, { status: 500 })
    }

    return NextResponse.json({ id: inserted.id as string, created: true })
  } catch (e) {
    console.error('[level-test/import] Unexpected error:', e)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
