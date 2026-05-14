import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub"

function initSentry() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    debug: true,
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

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") initSentry()
  if (process.env.NEXT_RUNTIME === "edge") initSentry()
}

export async function onRequestError(
  err: unknown,
  request: Parameters<typeof Sentry.captureRequestError>[1],
  context: Parameters<typeof Sentry.captureRequestError>[2],
) {
  Sentry.captureRequestError(err, request, context)
}
