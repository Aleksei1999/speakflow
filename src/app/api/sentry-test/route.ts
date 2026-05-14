import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  const before = {
    hasClient: !!Sentry.getClient(),
    clientDsn: Sentry.getClient()?.getOptions?.()?.dsn ?? null,
  }

  // Если register() не отработал на cold-start — инитим прямо тут.
  let lateInit = false
  if (!Sentry.getClient()) {
    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      Sentry.init({
        dsn,
        debug: true,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
        sendDefaultPii: false,
      })
      lateInit = true
    }
  }

  const eventId = Sentry.captureException(
    new Error(`Sentry global-SDK test ${new Date().toISOString()}`),
  )
  const flushOk = await Sentry.flush(8000)

  return NextResponse.json({
    before,
    lateInit,
    after: { hasClient: !!Sentry.getClient() },
    eventId,
    flushOk,
    runtime: process.env.NEXT_RUNTIME,
    env: process.env.VERCEL_ENV,
    hasDsnEnv: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  })
}
