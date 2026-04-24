// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron bridge: Vercel Cron sends GET only, but the queue drainer
 * at /api/internal/notifications/drain is POST-only (Agent B).
 *
 * This route simply proxies: on authenticated GET, it POSTs to
 * the drainer using the shared CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = new URL(request.url).origin
  const target = `${origin}/api/internal/notifications/drain`

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'x-cron-secret': cronSecret,
        'content-type': 'application/json',
      },
      // Empty body is fine; drainer knows what to do.
      body: JSON.stringify({}),
    })

    let body: any = null
    const text = await res.text()
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { raw: text }
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, upstream_status: res.status, upstream_body: body },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      upstream_status: res.status,
      upstream_body: body,
    })
  } catch (err: any) {
    console.error('[cron/drain] bridge error:', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'fetch failed' },
      { status: 500 }
    )
  }
}
