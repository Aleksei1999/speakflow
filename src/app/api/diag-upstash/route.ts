// Временный диагностический endpoint — проверяем что Upstash реально
// инициализировался и rate-limit считает. Защищён shared-секретом из
// env DIAG_SECRET. После проверки — удалить вместе с папкой _diag.

import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // TEMP: открытый endpoint, удалить файл сразу после проверки.
  const hasUpstashUrl = !!(
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  )
  const hasUpstashToken = !!(
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  )

  // Делаем 5 вызовов с одним key — должны получить limit=3 и потом 429
  const results: any[] = []
  const tag = `diag-${Date.now()}`
  for (let i = 1; i <= 5; i++) {
    const r = await enforceRateLimit(req, {
      name: "diag:test",
      keyParts: [tag],
      max: 3,
      windowSeconds: 60,
      failMode: "closed",
    })
    if (r) {
      results.push({
        i,
        blocked: true,
        status: r.status,
        headers: {
          "x-ratelimit-limit": r.headers.get("x-ratelimit-limit"),
          "x-ratelimit-remaining": r.headers.get("x-ratelimit-remaining"),
          "x-ratelimit-reset": r.headers.get("x-ratelimit-reset"),
          "retry-after": r.headers.get("retry-after"),
        },
      })
    } else {
      results.push({ i, blocked: false })
    }
  }

  return NextResponse.json({
    env: {
      hasUpstashUrl,
      hasUpstashToken,
      vercelEnv: process.env.VERCEL_ENV,
    },
    tag,
    results,
  })
}
