// ---------------------------------------------------------------
// Server-side rate limiter — Upstash Redis (preferred) with Postgres fallback.
//
// Why two backends:
//   - Upstash Redis даёт sub-millisecond sliding-window счётчик, бесплатный
//     dashboard через `analytics: true`, и survives холодные старты Vercel.
//   - Postgres RPC `check_rate_limit` остаётся как fallback на случай, если
//     env-переменные не выставлены (локалка без Upstash, smoke-test и т.п.)
//     и для нулевого даунтайма при включении.
//
// Selection logic:
//   if process.env.UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
//     -> Upstash (sliding window)
//   else
//     -> Postgres RPC (fixed-ish window, см. миграцию 20260510130000)
//
// Public API остаётся прежним — endpoint'ы дёргают enforceRateLimit /
// enforceRateLimitStrict / getClientIp. Никакие route-файлы менять не надо.
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
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
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
  /**
   * При отказе rate-limit инфраструктуры:
   *   'open'   (default) — пропускаем (UX-приоритет).
   *   'closed' — 503 (для auth / payment / admin / cron).
   */
  failMode?: "open" | "closed"
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

// ---------------------------------------------------------------
// Upstash plumbing (lazy, module-scoped)
// ---------------------------------------------------------------

/** Префикс для всех ключей. Изолируем от любых других @upstash/ratelimit
 *  instances, которые могут жить в том же Upstash аккаунте. */
const KEY_PREFIX = "ratelimit:speakflow"

let _redisChecked = false
let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redisChecked) return _redis
  _redisChecked = true
  // Vercel Marketplace integration ставит KV_REST_API_URL/_TOKEN.
  // Прямая установка Upstash CLI/Dashboard — UPSTASH_REDIS_REST_URL/_TOKEN.
  // Поддерживаем оба формата.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    _redis = null
    return null
  }
  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch (e) {
    console.warn("[rate-limit] failed to init Upstash Redis:", (e as Error)?.message)
    _redis = null
    return null
  }
}

/**
 * Ratelimit-инстансы кешируются по (max, windowSeconds), потому что:
 *   1) их дешевле переиспользовать (ephemeralCache работает внутри одной
 *      serverless-инстансии и режет лишние Redis round-trips);
 *   2) Upstash dashboard агрегирует по имени limiter'а — одно имя на бакет
 *      => наглядные графики.
 *
 * Имя бакета (opts.name) идёт в КЛЮЧ (`limit(key)`), а не в конструктор,
 * — поэтому один Ratelimit-инстанс обслуживает все бакеты с одинаковыми
 * (max, window).
 */
const _limiters = new Map<string, Ratelimit>()

function getLimiter(max: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const key = `${max}:${windowSeconds}`
  const existing = _limiters.get(key)
  if (existing) return existing
  // Duration template literal: `${number} ${Unit}` или `${number}${Unit}`.
  const window = `${windowSeconds} s` as const
  const limiter = new Ratelimit({
    redis,
    // slidingWindow точнее fixedWindow и нативно поддерживается Upstash.
    // Cost: 1 Redis-команда на запрос (EVALSHA на Lua-скрипт).
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: KEY_PREFIX,
    // Бесплатный dashboard https://console.upstash.com/ratelimit.
    analytics: true,
    // Локальный кеш заблокированных identifier'ов внутри одной hot-инстансии
    // serverless function: повторные запросы блокируются без Redis round-trip.
    ephemeralCache: new Map(),
    // Network timeout — если Upstash залип, лучше пропустить запрос (или
    // failMode='closed' вернёт 503 на верхнем уровне).
    timeout: 1500,
  })
  _limiters.set(key, limiter)
  return limiter
}

// ---------------------------------------------------------------
// Postgres fallback (existing implementation)
// ---------------------------------------------------------------

async function postgresCheck(
  bucketKey: string,
  max: number,
  windowSeconds: number
): Promise<{ allowed: boolean; error?: string }> {
  const admin = createAdminClient()
  const { data, error } = await (admin.rpc as any)("check_rate_limit", {
    p_bucket: bucketKey,
    p_max_requests: max,
    p_window_seconds: windowSeconds,
  })
  if (error) return { allowed: true, error: `RPC error: ${error.message}` }
  return { allowed: data !== false }
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * Returns null if the request is allowed.
 * Returns a 429 NextResponse if the limit was exceeded — the caller should
 * just `return` it as the response.
 *
 * On infrastructure failure:
 *   failMode='open'   — пропускаем запрос (UX-приоритет, дефолт).
 *   failMode='closed' — возвращаем 503 (auth/payment/admin/cron).
 */
export async function enforceRateLimit(
  _req: NextRequest,
  opts: RateLimitOptions
): Promise<NextResponse | null> {
  const failMode = opts.failMode ?? "open"
  const onFailure = (reason: string) => {
    if (failMode === "open") {
      console.warn(`[rate-limit] ${reason}, failing open (${opts.name})`)
      return null
    }
    console.warn(`[rate-limit] ${reason}, failing closed (${opts.name})`)
    return NextResponse.json(
      { error: "Сервис временно недоступен. Попробуй чуть позже." },
      { status: 503, headers: { "Retry-After": "30" } }
    )
  }

  const bucketKey = [opts.name, ...opts.keyParts.filter(Boolean)].join(":")

  // ------- 1) Try Upstash -------
  const limiter = getLimiter(opts.max, opts.windowSeconds)
  if (limiter) {
    try {
      const res = await limiter.limit(bucketKey)
      if (res.success) return null
      // Block. `reset` — Unix ms timestamp когда лимит сбросится.
      const retryAfterSec = Math.max(
        1,
        Math.ceil((res.reset - Date.now()) / 1000)
      )
      return NextResponse.json(
        {
          error: "Слишком много попыток. Попробуй через минуту.",
          retry_after: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(res.limit),
            "X-RateLimit-Remaining": String(Math.max(0, res.remaining)),
            "X-RateLimit-Reset": String(Math.floor(res.reset / 1000)),
            "X-RateLimit-Window": String(opts.windowSeconds),
          },
        }
      )
    } catch (e: any) {
      return onFailure(`upstash crashed: ${e?.message ?? e}`)
    }
  }

  // ------- 2) Fallback to Postgres RPC -------
  try {
    const { allowed, error } = await postgresCheck(
      bucketKey,
      opts.max,
      opts.windowSeconds
    )
    if (error) return onFailure(error)
    if (allowed) return null
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
  } catch (e: any) {
    return onFailure(`postgres crashed: ${e?.message ?? e}`)
  }
}

/** Для security-critical (auth/payment/admin/cron) — fail-closed. */
export function enforceRateLimitStrict(
  req: NextRequest,
  opts: Omit<RateLimitOptions, "failMode">
): Promise<NextResponse | null> {
  return enforceRateLimit(req, { ...opts, failMode: "closed" })
}
