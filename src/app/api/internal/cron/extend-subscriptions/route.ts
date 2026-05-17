// ---------------------------------------------------------------
// POST /api/internal/cron/extend-subscriptions
//
// Daily cron: дёргает RPC `extend_lesson_subscriptions()` (миграция 082),
// которая досоздаёт lessons-occurrences для всех active subscriptions
// в окне `min(ends_on, current_date + 14)`.
//
// Авторизация: Bearer ${CRON_SECRET}, как и остальные /api/internal/cron/*.
//
// На текущий момент в БД уже зарегистрирован pg_cron job
// `lesson_subscriptions_extend` (миграция 082, §7), который вызывает
// RPC напрямую SQL'ом `SELECT public.extend_lesson_subscriptions();`.
// Этот HTTP-endpoint — параллельный путь:
//   - удобнее observability (Vercel logs, Sentry traces, Speed Insights);
//   - можно дёрнуть из Vercel Cron / внешнего pinger / manual recovery;
//   - если в будущем перевешаем cron в vercel.json — endpoint уже готов.
//
// Дублирование вызовов безопасно: RPC внутри SKIP-ает уже существующие
// слоты (unique/exclusion constraints на lessons), audit-логирует
// skips отдельно. Идемпотентность гарантирована constraints'ами.
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
// 60s достаточно с запасом: RPC одна итерация по active subscriptions,
// каждая делает 1-N INSERT с конфликт-handling'ом. На фракции тысяч подписок
// это секунды максимум.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // RPC GRANT'нут только postgres/service_role — admin-клиент использует
  // service_role key, так что вызов проходит.
  // FIXME(types): custom RPC не в Database typegen
  const { data, error } = await (admin.rpc as any)('extend_lesson_subscriptions')

  if (error) {
    console.error('[cron/extend-subscriptions] RPC failed', {
      message: error.message,
      code: (error as any)?.code,
      details: (error as any)?.details,
    })
    return NextResponse.json(
      { ok: false, error: error.message ?? 'RPC failed' },
      { status: 500 }
    )
  }

  // RPC возвращает {subs_touched, lessons_created, lessons_skipped}.
  console.log('[cron/extend-subscriptions] OK', data)

  return NextResponse.json({ ok: true, ...((data as object) ?? {}) })
}
