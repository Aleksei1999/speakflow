// Client (browser) Sentry config. Подгружается в browser bundle.
// DSN public, можно безопасно держать в NEXT_PUBLIC env.

import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent, scrubSentryBreadcrumb } from "@/lib/sentry/scrub"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // 10% запросов в перфоманс-трейс — компромисс между видимостью и квотой.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Сессионные replay только при ошибке (бесплатный план)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Никогда не присоединяем PII (email/IP юзера) автоматически.
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb)
    },
    // Шум: расширения Chrome, network failures от пользователя.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
      "NetworkError when attempting to fetch resource.",
      "Failed to fetch",
      "Load failed",
      "AbortError",
    ],
  })
}
