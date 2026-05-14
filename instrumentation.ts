import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

function init() {
  if (!dsn) return
  // eslint-disable-next-line no-console
  console.log("[sentry] register() init", {
    runtime: process.env.NEXT_RUNTIME,
    env: process.env.VERCEL_ENV,
  })
  Sentry.init({
    dsn,
    debug: true,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    ignoreErrors: ["ECONNRESET", "EPIPE", "ETIMEDOUT"],
  })
}

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") init()
  if (process.env.NEXT_RUNTIME === "edge") init()
}

export async function onRequestError(
  err: unknown,
  request: Parameters<typeof Sentry.captureRequestError>[1],
  context: Parameters<typeof Sentry.captureRequestError>[2],
) {
  Sentry.captureRequestError(err, request, context)
}
