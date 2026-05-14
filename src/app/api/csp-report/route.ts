// @ts-nocheck
// CSP violation reporter. Сохраняем нарушения в public.csp_violations —
// dedup-индекс по (directive, blocked, document_uri, hour) делает писать
// в БД безопасным даже под массовой атакой репортами.

import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { protectPublic } from "@/lib/api/arcjet"

export const dynamic = "force-dynamic"

const MAX_FIELD_LEN = 1000

function clip(value: unknown): string | null {
  if (value == null) return null
  const str = String(value)
  return str.length > MAX_FIELD_LEN ? str.slice(0, MAX_FIELD_LEN) : str
}

export async function POST(request: NextRequest) {
  // Arcjet: shield + bot detection. Атакующие любят слать кривые
  // CSP-репорты, чтобы прощупать схему. Но: если Arcjet вернул Deny
  // мы НЕ хотим 403 показывать браузеру (он перестанет репортить),
  // отвечаем 204 — для CSP-механизма это эквивалент "принято".
  // Сам факт denied всё равно залогирован в protectPublic().
  const ajDeny = await protectPublic(request)
  if (ajDeny) return new NextResponse(null, { status: 204 })

  const limited = await enforceRateLimit(request, {
    name: "csp:report",
    keyParts: [getClientIp(request)],
    max: 100,
    windowSeconds: 60,
    // fail-open: нельзя ломать CSP-репортинг браузерам при отказе RPC.
    failMode: "open",
  })
  if (limited) return new NextResponse(null, { status: 429 })

  try {
    const ct = request.headers.get("content-type") ?? ""
    let payload: any = null

    if (ct.includes("application/csp-report") || ct.includes("application/reports+json") || ct.includes("application/json")) {
      try {
        payload = await request.json()
      } catch {
        payload = null
      }
    }
    if (!payload) return new NextResponse(null, { status: 204 })

    // Старый формат: { "csp-report": {...} }.
    // Новый report-to: массив [{ type: 'csp-violation', body: {...} }].
    const reports: any[] = Array.isArray(payload)
      ? payload.map((r) => r.body ?? r)
      : payload["csp-report"]
        ? [payload["csp-report"]]
        : [payload]

    const userAgent = request.headers.get("user-agent")
    const rows = reports
      .map((r) => ({
        directive: clip(r["violated-directive"] ?? r["effectiveDirective"]) ?? "?",
        blocked: clip(r["blocked-uri"] ?? r["blockedURL"]) ?? "?",
        document_uri: clip(r["document-uri"] ?? r["documentURL"]),
        sample: clip(r["script-sample"] ?? r["sample"]),
        user_agent: clip(userAgent),
      }))
      // Игнорируем шум: chrome-extension://, about:blank, и т.п.
      .filter((r) => !r.blocked.startsWith("chrome-extension:") && !r.blocked.startsWith("moz-extension:"))

    if (rows.length === 0) return new NextResponse(null, { status: 204 })

    const admin = createAdminClient()
    // UNIQUE dedup-индекс по (directive, blocked, doc, hour) — повторы за час
    // не плодим. ON CONFLICT DO NOTHING тише чем upsert.
    const { error } = await admin
      .from("csp_violations")
      .insert(rows, { count: "exact" })
    if (error && !String(error.message).includes("duplicate key")) {
      console.warn("[csp] insert failed:", error.message)
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    console.warn("[csp] reporter crashed:", e)
    return new NextResponse(null, { status: 204 })
  }
}
