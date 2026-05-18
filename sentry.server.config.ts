// Server (Node.js) Sentry config. Подгружается в API routes / SSR.

import * as Sentry from "@sentry/nextjs"
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/sentry/scrub"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
const isProduction = process.env.NODE_ENV === "production"

if (dsn) {
  Sentry.init({
    dsn,
    debug: !isProduction,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
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
