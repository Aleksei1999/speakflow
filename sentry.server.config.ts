// Server (Node.js) Sentry config. Подгружается в API routes / SSR.

import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
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
    // На server тоже фильтруем шум.
    ignoreErrors: [
      "ECONNRESET",
      "EPIPE",
      "ETIMEDOUT",
      // Stripe/YooKassa выкидывают rich errors — кидаем сами через capture.
    ],
  })
}
