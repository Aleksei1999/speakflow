// Next.js / Vercel instrumentation hook.
//
// Sentry.init вынесен в src/lib/sentry/server-init.ts с side-effect
// импортом. Сам по себе register() на Vercel cold-start serverless
// может не успеть отработать до первого handler invoke — поэтому
// критические server routes импортят server-init напрямую.

import * as Sentry from "@sentry/nextjs"
import { validateProductionEnv } from "@/lib/env/production"
import { ensureSentry } from "@/lib/sentry/server-init"

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateProductionEnv()
    ensureSentry()
  }
  if (process.env.NEXT_RUNTIME === "edge") ensureSentry()
}

export async function onRequestError(
  err: unknown,
  request: Parameters<typeof Sentry.captureRequestError>[1],
  context: Parameters<typeof Sentry.captureRequestError>[2],
) {
  ensureSentry()
  Sentry.captureRequestError(err, request, context)
}
