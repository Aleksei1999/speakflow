// Идемпотентный server-side Sentry init.
//
// Назначение: на Vercel cold-start serverless function instrumentation.ts
// register() **не** успевает отработать до первого request handler —
// поэтому Sentry.getClient() === null и события дропаются. Импортируем
// этот модуль из любого server-side route, чтобы гарантировать инит
// перед captureException.
//
// Импорт повторно не запускает init (модуль кешируется Node, плюс
// внутри ensureSentry проверка на getClient).

import * as Sentry from "@sentry/nextjs"
import { scrubSentryEvent, scrubSentryBreadcrumb } from "./scrub"

let initialized = false

export function ensureSentry(): void {
  if (initialized) return
  if (Sentry.getClient()) {
    initialized = true
    return
  }
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
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
  initialized = true
}

// Вызываем при импорте модуля — на cold-start это первый импорт после
// boot функции, до handler'а.
ensureSentry()
