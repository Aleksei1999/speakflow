// @ts-nocheck
// CSP violation reporter. Браузер шлёт сюда POST'ом тело
// { "csp-report": {...} } или новый report-to JSON-формат при
// нарушении нашей Content-Security-Policy.
//
// Сейчас CSP накатан в Report-Only — ничего не блокируется, но
// браузер отдаёт нам отчёты, чтобы мы могли расширить policy
// перед enforce.

import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  // Защита от DoS: один и тот же violation может прилететь сотнями раз
  // (одна неподписанная директива × количество ассетов на странице).
  // 60 отчётов в минуту с одного IP — потолок.
  const limited = await enforceRateLimit(request, {
    name: "csp:report",
    keyParts: [getClientIp(request)],
    max: 60,
    windowSeconds: 60,
  })
  if (limited) return new NextResponse(null, { status: 429 })

  try {
    const ct = request.headers.get("content-type") ?? ""
    let payload: any = null

    if (ct.includes("application/csp-report") || ct.includes("application/json")) {
      try {
        payload = await request.json()
      } catch {
        payload = null
      }
    }

    if (!payload) {
      return new NextResponse(null, { status: 204 })
    }

    // Старый формат: { "csp-report": { "blocked-uri": "...", "violated-directive": "...", ... } }
    // Новый формат (report-to): массив [{ "type": "csp-violation", "body": {...} }]
    const reports: any[] = Array.isArray(payload)
      ? payload.map((r) => r.body ?? r)
      : payload["csp-report"]
        ? [payload["csp-report"]]
        : [payload]

    for (const r of reports) {
      const blocked = r["blocked-uri"] ?? r["blockedURL"] ?? "?"
      const directive = r["violated-directive"] ?? r["effectiveDirective"] ?? "?"
      const docUri = r["document-uri"] ?? r["documentURL"] ?? "?"
      const sample = r["script-sample"] ?? r["sample"] ?? null
      // Лоигруем компактно — Vercel logs дешёвые, но шум выкручивать не хочется.
      console.warn(
        `[csp] directive=${directive} blocked=${blocked} doc=${docUri}${sample ? ` sample="${String(sample).slice(0, 80)}"` : ""}`
      )
    }

    return new NextResponse(null, { status: 204 })
  } catch (e) {
    // Никогда не падаем 5xx из reporter'а — браузер начнёт ретраить.
    console.warn("[csp] reporter crashed:", e)
    return new NextResponse(null, { status: 204 })
  }
}
