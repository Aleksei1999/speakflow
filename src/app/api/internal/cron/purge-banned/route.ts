// Ежедневный крон: удаляет аккаунты, отключённые от платформы админом и не возвращённые за 30 дней.
// Отключение = profiles.is_active=false + бан в Supabase Auth на 30 дней (banned_until).
// Когда banned_until прошёл, а is_active всё ещё false — удаляем пользователя через auth.admin.deleteUser
// (профиль и связанные строки уходят каскадом). Пользователей без banned_until не трогаем.
// Vercel Cron вызывает GET с заголовком Authorization: Bearer <CRON_SECRET>; POST — для ручного запуска.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function purge(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, email')
    .eq('is_active', false)
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const deleted: string[] = []
  const skipped: string[] = []
  const failed: Array<{ id: string; error: string }> = []
  for (const r of (rows ?? []) as Array<{ id: string; email: string | null }>) {
    const { data: au } = await admin.auth.admin.getUserById(r.id)
    const until = (au?.user as { banned_until?: string | null } | undefined)?.banned_until
    if (!until || new Date(until).getTime() > now) { skipped.push(r.id); continue }
    const { error: delErr } = await admin.auth.admin.deleteUser(r.id)
    if (delErr) { failed.push({ id: r.id, error: delErr.message }); continue }
    await admin.from('profiles').delete().eq('id', r.id)
    deleted.push(r.id)
  }
  console.log('[cron/purge-banned]', { deleted: deleted.length, skipped: skipped.length, failed: failed.length })
  return NextResponse.json({ ok: true, deleted, skipped: skipped.length, failed })
}

export async function GET(req: NextRequest) { return purge(req) }
export async function POST(req: NextRequest) { return purge(req) }
