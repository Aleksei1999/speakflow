// Cron: Google → платформа для всех подключённых учителей (импорт чужих событий с учеником,
// перенос наших событий, отмена удалённых). Логика в src/lib/google-calendar/sync.ts;
// та же синхронизация запускается «по требованию» при открытии кабинета учителя/админа.
// Vercel Cron вызывает GET с Authorization: Bearer <CRON_SECRET>.

import { NextRequest, NextResponse } from 'next/server'
import { syncAllTeachersFromGoogle } from '@/lib/google-calendar/sync'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results = await syncAllTeachersFromGoogle()
  const sum = (k: 'imported' | 'updated' | 'cancelled') => results.reduce((a, r) => a + r[k], 0)
  const errors = results.flatMap((r) => r.errors.map((e) => `${r.teacherUserId}: ${e}`))
  console.log('[cron/gcal-sync]', { teachers: results.length, imported: sum('imported'), updated: sum('updated'), cancelled: sum('cancelled'), errors: errors.length })
  return NextResponse.json({ ok: true, teachers: results.length, imported: sum('imported'), updated: sum('updated'), cancelled: sum('cancelled'), errors: errors.length ? errors : undefined })
}
