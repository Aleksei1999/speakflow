"use client"

// Глобальный error boundary App Router. Срабатывает только когда
// корневой layout сам падает (редко). Все остальные ошибки ловит
// route-level error.tsx. Sentry capture'ит и то и другое.

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ru">
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
            Что-то сломалось
          </h1>
          <p style={{ color: "#999", fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
            Мы уже знаем об ошибке и чиним. Можешь перезагрузить страницу.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#E63946",
              color: "#fff",
              border: 0,
              padding: "12px 26px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Перезагрузить
          </button>
        </div>
      </body>
    </html>
  )
}
