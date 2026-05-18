"use client"

// Глобальный error boundary App Router. Срабатывает только когда
// корневой layout сам падает (редко). Ошибки в dashboard ловят
// error.tsx в сегментах student / teacher / admin. Sentry capture'ит и то и другое.
//
// Внимание: этот компонент рендерится ВНЕ next-intl provider,
// поэтому useTranslations() здесь работать не будет — читаем
// локаль из cookie на клиенте и подставляем строки руками.

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"

const COPY = {
  ru: {
    title: "Что-то сломалось",
    subtitle: "Мы уже знаем об ошибке и чиним. Можешь перезагрузить страницу.",
    cta: "Перезагрузить",
  },
  en: {
    title: "Something broke",
    subtitle: "We're already on it. Try reloading the page.",
    cta: "Reload",
  },
} as const

type Locale = keyof typeof COPY

function readLocale(): Locale {
  if (typeof document === "undefined") return "ru"
  const m = document.cookie.match(/(?:^|;\s*)rwen_locale=(ru|en)/)
  return (m?.[1] as Locale) ?? "ru"
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<Locale>("ru")

  useEffect(() => {
    Sentry.captureException(error)
    setLocale(readLocale())
  }, [error])

  const t = COPY[locale]

  return (
    <html lang={locale}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fff",
          padding: 24,
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            {t.title}
          </h1>
          <p style={{ color: "#999", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
            {t.subtitle}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#B63F37",
              color: "#fff",
              border: 0,
              padding: "12px 26px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.cta}
          </button>
        </div>
      </body>
    </html>
  )
}
