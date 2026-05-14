import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  const hasDsnEnv = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  // Sentry-клиент может быть undefined если init не сработал.
  const client = Sentry.getClient?.()
  const clientDsn = client?.getDsn?.()

  let eventId: string | undefined
  let flushOk = false
  try {
    eventId = Sentry.captureException(
      new Error(`Sentry server diag at ${new Date().toISOString()}`)
    )
    flushOk = await Sentry.flush(3000)
  } catch (e: any) {
    return NextResponse.json({
      hasDsnEnv,
      clientInited: !!client,
      hasDsn: !!clientDsn,
      err: String(e?.message ?? e),
    })
  }
  return NextResponse.json({
    hasDsnEnv,
    clientInited: !!client,
    hasDsn: !!clientDsn,
    eventId: eventId ?? null,
    flushOk,
  })
}
