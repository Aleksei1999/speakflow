// Next.js / Vercel instrumentation hook.
//
// На Vercel serverless register() **не всегда** успевает отработать до
// первого request на cold-start function. Поэтому Sentry.init вынесен
// на top-level — выполняется при импорте модуля (то есть при boot
// функции до hashing handler'а). register() оставлен как идемпотентный
// fallback на edge runtime.

import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

function init() {
  if (!dsn) return
  if (Sentry.getClient()) return
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb)
    },
    ignoreErrors: ["ECONNRESET", "EPIPE", "ETIMEDOUT"],
  })
}

// Top-level init: вызывается сразу при импорте instrumentation.ts.
init()

export function register() {
  // Idempotent fallback.
  init()
}

export async function onRequestError(
  err: unknown,
  request: Parameters<typeof Sentry.captureRequestError>[1],
  context: Parameters<typeof Sentry.captureRequestError>[2],
) {
  Sentry.captureRequestError(err, request, context)
}
