import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  const hasDsnEnv = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  const initialized = (Sentry as any).isInitialized?.() ?? false

  // Если SDK не инициализирован (instrumentation hook не сработал) —
  // делаем поздний init прямо здесь. Это покажет: проблема в инициализации
  // или в самой отправке.
  let lateInit = false
  if (!initialized) {
    const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      Sentry.init({ dsn, debug: true, environment: process.env.VERCEL_ENV })
      lateInit = true
    }
  }

  let eventId: string | undefined
  let flushOk = false
  let flushErr: string | null = null
  try {
    eventId = Sentry.captureException(
      new Error(`Sentry diag at ${new Date().toISOString()}`)
    )
    flushOk = await Sentry.flush(5000)
  } catch (e: any) {
    flushErr = String(e?.message ?? e)
  }

  return NextResponse.json({
    hasDsnEnv,
    initialized,
    lateInit,
    eventId: eventId ?? null,
    flushOk,
    flushErr,
  })
}
