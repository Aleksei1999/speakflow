// POST /api/admin/google-sync — ручной запуск синхронизации Google → платформа для всех подключённых учителей.
// Admin-only. Возвращает результат по каждому учителю (импорт / переносы / отмены / ошибки) — удобно для диагностики.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin-guard'
import { syncAllTeachersFromGoogle } from '@/lib/google-calendar/sync'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const results = await syncAllTeachersFromGoogle()
  return NextResponse.json({ ok: true, results })
}
