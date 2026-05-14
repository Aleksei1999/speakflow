import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

// Тестовый endpoint: GET → бросает ошибку, Sentry должен её поймать.
// Удалить после проверки.
export async function GET() {
  try {
    throw new Error(`Sentry server test at ${new Date().toISOString()}`)
  } catch (e) {
    Sentry.captureException(e)
    await Sentry.flush(2000)
    return NextResponse.json({ sent: true, ts: new Date().toISOString() })
  }
}
