"use client"

import * as Sentry from "@sentry/nextjs"
import { useState } from "react"

export default function SentryExamplePage() {
  const [serverResult, setServerResult] = useState<string>("")

  function throwClient() {
    throw new Error(`Sentry client test @ ${new Date().toISOString()}`)
  }

  async function callServer() {
    setServerResult("…")
    const r = await fetch("/api/sentry-test")
    const j = await r.json().catch(() => ({}))
    setServerResult(JSON.stringify(j))
  }

  function captureMessage() {
    Sentry.captureMessage("Manual Sentry.captureMessage from client")
    setServerResult("captureMessage sent (check Sentry)")
  }

  return (
    <main style={{ maxWidth: 520, margin: "60px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Sentry verification</h1>
      <p style={{ color: "#666", marginBottom: 20, fontSize: 14 }}>
        Эту страницу удалим после успешной проверки. Каждая кнопка кидает
        ошибку — она должна появиться в Sentry → Issues в течение 10–30 сек.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={throwClient}
          style={{ padding: "12px 18px", background: "#E63946", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Бросить ошибку на клиенте
        </button>

        <button
          onClick={captureMessage}
          style={{ padding: "12px 18px", background: "#0A0A0A", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Sentry.captureMessage (info)
        </button>

        <button
          onClick={callServer}
          style={{ padding: "12px 18px", background: "#1d4ed8", color: "#fff", border: 0, borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Бросить серверную ошибку (/api/sentry-test)
        </button>

        {serverResult && (
          <pre style={{ background: "#f4f4f4", padding: 12, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
            {serverResult}
          </pre>
        )}
      </div>
    </main>
  )
}
