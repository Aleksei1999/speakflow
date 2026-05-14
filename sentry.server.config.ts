// Server (Node.js) Sentry config. Подгружается в API routes / SSR.

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  // eslint-disable-next-line no-console
  console.log("[sentry] server init", { hasDsn: !!dsn, env: process.env.VERCEL_ENV })
  Sentry.init({
    dsn,
    debug: true,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    // beforeSend / beforeBreadcrumb временно убраны — проверяем, не дропает ли
    // scrub события. Вернём после диагностики.
    ignoreErrors: ["ECONNRESET", "EPIPE", "ETIMEDOUT"],
  })
}
