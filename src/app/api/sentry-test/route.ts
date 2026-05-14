import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  const client = Sentry.getClient()
  const opts = client?.getOptions?.() ?? null
  const eventId = Sentry.captureException(
    new Error(`Sentry global-SDK test ${new Date().toISOString()}`),
  )
  const flushOk = await Sentry.flush(8000)
  return NextResponse.json({
    eventId,
    flushOk,
    hasClient: !!client,
    clientDsn: opts?.dsn ?? null,
    runtime: process.env.NEXT_RUNTIME,
    env: process.env.VERCEL_ENV,
    hasDsnEnv: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  })
}
