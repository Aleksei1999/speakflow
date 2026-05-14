import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  // Init без beforeSend / scrub — чисто проверить транспорт.
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return NextResponse.json({ error: "no DSN" }, { status: 500 })

  // Создаём независимый client (не через global Sentry.init) — чтобы
  // existing init не мешал.
  const { NodeClient, makeNodeTransport, defaultStackParser } = await import("@sentry/node")
  const client = new NodeClient({
    dsn,
    transport: makeNodeTransport,
    stackParser: defaultStackParser,
    integrations: [],
    environment: process.env.VERCEL_ENV,
    debug: true,
    tracesSampleRate: 0,
  })

  const eventId = client.captureException(
    new Error(`Sentry pure-transport test ${new Date().toISOString()}`)
  )

  const flushOk = await client.flush(8000)
  return NextResponse.json({ eventId, flushOk })
}
