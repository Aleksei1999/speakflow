import "@/lib/sentry/server-init"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

// Verification endpoint для PII scrub: запихиваем «грязные» значения
// в message + extra, потом ловим event API'ем и проверяем что
// scrub заменил их на [redacted-*].
export async function GET() {
  const tag = `pii-${Date.now()}`
  const dirty = {
    email: "ivan.petrov+tag@example.com",
    phone: "+7 916 123-45-67",
    jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    bearer: "Bearer abcdef123456ghijklmnop",
    sbKey: "sbp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
    sk: "sk_live_51AbCdEfGhIjKlMnOpQrStUv",
    password: "should-be-redacted",
  }
  Sentry.withScope((scope) => {
    scope.setTag("test", tag)
    scope.setExtra("dirty_payload", dirty)
    Sentry.captureException(
      new Error(
        `PII scrub test ${tag}: ${dirty.email} ${dirty.phone} ${dirty.jwt} ${dirty.bearer} ${dirty.sbKey} ${dirty.sk}`,
      ),
    )
  })
  const flushOk = await Sentry.flush(8000)
  return NextResponse.json({ tag, flushOk, hasClient: !!Sentry.getClient() })
}
