// @ts-nocheck
/**
 * POST /api/internal/notifications/drain
 *
 * Internal endpoint invoked by a Vercel Cron bridge (Agent C's /api/internal/cron/*)
 * that walks the public.notifications_queue outbox and actually ships each queued
 * notification via sendNotification() (email + telegram).
 *
 * Auth: shared `x-cron-secret` header matched against process.env.CRON_SECRET.
 * Runs in the Node.js runtime because sendNotification() depends on Node
 * crypto / fetch semantics and admin Supabase client.
 *
 * Batch size: 100 rows per invocation. Rows with 5+ failed retries are skipped.
 * Successes flip processed_at + clear `error`. Failures bump `retries` and stash
 * the error message; they'll be retried on the next cron tick.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: rows, error } = await supabase
    .from('notifications_queue')
    .select('*')
    .is('processed_at', null)
    .lt('retries', 5)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let failed = 0

  for (const row of rows ?? []) {
    try {
      await sendNotification(row.user_id, row.type, row.payload ?? {})
      await supabase
        .from('notifications_queue')
        .update({ processed_at: new Date().toISOString(), error: null })
        .eq('id', row.id)
      processed++
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await supabase
        .from('notifications_queue')
        .update({
          error: message,
          retries: (row.retries ?? 0) + 1,
        })
        .eq('id', row.id)
      failed++
    }
  }

  return NextResponse.json({
    processed,
    failed,
    total: rows?.length ?? 0,
  })
}

export async function GET() {
  return NextResponse.json({ error: 'POST only' }, { status: 405 })
}
