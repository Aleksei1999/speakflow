import "@/lib/sentry/server-init"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  const eventId = Sentry.captureException(
    new Error(`Sentry global-SDK test ${new Date().toISOString()}`),
  )
  const flushOk = await Sentry.flush(8000)
  return NextResponse.json({
    eventId,
    flushOk,
    hasClient: !!Sentry.getClient(),
    runtime: process.env.NEXT_RUNTIME,
    env: process.env.VERCEL_ENV,
  })
}
