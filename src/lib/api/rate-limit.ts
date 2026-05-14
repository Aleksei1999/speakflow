// ---------------------------------------------------------------
// Server-side rate limiter built on Postgres RPC `check_rate_limit`.
//
// Why DB-side instead of in-memory: на Vercel/Fluid Compute каждая
// инстанция функции имеет свой RAM, in-memory счётчик не работает
// между холодными стартами и параллельными запросами. RPC даёт
// атомарный sliding-window счётчик через одну Postgres-таблицу.
//
// Usage in route:
//   const limited = await enforceRateLimit(req, {
//     name: "auth:signup",
//     keyParts: [getClientIp(req)],
//     max: 5,
//     windowSeconds: 60 * 10,
//   })
//   if (limited) return limited  // already a NextResponse with 429
//   ... продолжаем обработку
// ---------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type RateLimitOptions = {
  /** Logical bucket name, e.g. "auth:signup" or "jitsi:token". */
  name: string
  /** Identity bits — IP + optional user_id / email. Joined into the bucket key. */
  keyParts: Array<string | null | undefined>
  /** Max requests per window. */
  max: number
  /** Window length in seconds. */
  windowSeconds: number
}

/** Best-effort client IP from common proxy headers. Vercel + nginx + CF all set these. */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf.trim()
  return "unknown"
}

/**
 * Returns null if the request is allowed.
 * Returns a 429 NextResponse if the limit was exceeded — the caller should
 * just `return` it as the response.
 *
 * On infrastructure failure (RPC down) we fail OPEN — лимит лучше не быть,
 * чем сервис лежит. Серверу всё равно есть RLS / auth-гейты выше по стеку.
 */
export async function enforceRateLimit(
  _req: NextRequest,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  try {
    const key = [opts.name, ...opts.keyParts.filter(Boolean)].join(":")
    const admin = createAdminClient()
    const { data, error } = await (admin.rpc as any)("check_rate_limit", {
      p_bucket: key,
      p_max_requests: opts.max,
      p_window_seconds: opts.windowSeconds,
    })
    if (error) {
      console.warn("[rate-limit] RPC error, failing open:", error.message)
      return null
    }
    if (data === false) {
      const retryAfter = Math.ceil(opts.windowSeconds / 2)
      return NextResponse.json(
        {
          error: "Слишком много попыток. Попробуй через минуту.",
          retry_after: retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(opts.max),
            "X-RateLimit-Window": String(opts.windowSeconds),
          },
        }
      )
    }
    return null
  } catch (e) {
    console.warn("[rate-limit] crashed, failing open:", e)
    return null
  }
}
