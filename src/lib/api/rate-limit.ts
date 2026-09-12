// Server-side rate limiter: Upstash Redis (sliding window), если заданы
// env-переменные, иначе fallback на Postgres RPC `check_rate_limit`
// (локалка без Upstash, smoke-тесты).

import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { Ratelimit } from "@upstash/ratelimit"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRedis } from "@/lib/redis"

export type RateLimitOptions = {
  /** Logical bucket name, e.g. "auth:signup". */
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

/** Префикс для всех ключей. Изолируем от любых других @upstash/ratelimit
 *  instances, которые могут жить в том же Upstash аккаунте. */
const KEY_PREFIX = "ratelimit:speakflow"
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

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; limit: number; remaining: number; reset: number | null }
  | { allowed: null; reason: string }

/**
 * Низкоуровневая проверка без привязки к NextRequest — для роутов и server actions.
 * allowed: true — пропускаем; false — лимит исчерпан; null — инфраструктура лимитера недоступна
 * (решение fail-open/closed принимает вызывающий).
 */
export async function checkRateLimit(opts: Omit<RateLimitOptions, "failMode">): Promise<RateLimitCheck> {
  const bucketKey = [opts.name, ...opts.keyParts.filter(Boolean)].join(":")

  const limiter = getLimiter(opts.max, opts.windowSeconds)
  if (limiter) {
    try {
      const res = await limiter.limit(bucketKey)
      if (res.success) return { allowed: true }
      // `reset` — Unix ms timestamp когда лимит сбросится.
      const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000))
      return { allowed: false, retryAfterSec, limit: res.limit, remaining: Math.max(0, res.remaining), reset: res.reset }
    } catch (e: any) {
      return { allowed: null, reason: `upstash crashed: ${e?.message ?? e}` }
    }
  }

  // Fallback: Postgres RPC
  try {
    const { allowed, error } = await postgresCheck(bucketKey, opts.max, opts.windowSeconds)
    if (error) return { allowed: null, reason: error }
    if (allowed) return { allowed: true }
    return { allowed: false, retryAfterSec: Math.ceil(opts.windowSeconds / 2), limit: opts.max, remaining: 0, reset: null }
  } catch (e: any) {
    return { allowed: null, reason: `postgres crashed: ${e?.message ?? e}` }
  }
}

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
  const res = await checkRateLimit(opts)
  if (res.allowed === true) return null
  if (res.allowed === null) {
    if (failMode === "open") {
      console.warn(`[rate-limit] ${res.reason}, failing open (${opts.name})`)
      return null
    }
    console.warn(`[rate-limit] ${res.reason}, failing closed (${opts.name})`)
    return NextResponse.json(
      { error: "Сервис временно недоступен. Попробуй чуть позже." },
      { status: 503, headers: { "Retry-After": "30" } }
    )
  }
  const headers: Record<string, string> = {
    "Retry-After": String(res.retryAfterSec),
    "X-RateLimit-Limit": String(res.limit),
    "X-RateLimit-Remaining": String(res.remaining),
    "X-RateLimit-Window": String(opts.windowSeconds),
  }
  if (res.reset) headers["X-RateLimit-Reset"] = String(Math.floor(res.reset / 1000))
  return NextResponse.json(
    { error: "Слишком много попыток. Попробуй через минуту.", retry_after: res.retryAfterSec },
    { status: 429, headers }
  )
}

/**
 * Для server actions (нет NextRequest): бросает Error с человеческим текстом,
 * когда лимит исчерпан. При недоступности лимитера — пропускает (fail-open).
 */
export async function assertRateLimit(opts: Omit<RateLimitOptions, "failMode"> & { message?: string }): Promise<void> {
  const res = await checkRateLimit(opts)
  if (res.allowed === true) return
  if (res.allowed === null) {
    console.warn(`[rate-limit] ${res.reason}, failing open (${opts.name})`)
    return
  }
  throw new Error(opts.message ?? "Слишком много запросов. Подождите минуту.")
}

/** IP клиента внутри server action — из заголовков запроса (next/headers). */
export async function getClientIpFromHeaders(): Promise<string> {
  const h = await headers()
  const xff = h.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return h.get("x-real-ip")?.trim() || h.get("cf-connecting-ip")?.trim() || "unknown"
}

/** Для security-critical (auth/payment/admin/cron) — fail-closed. */
export function enforceRateLimitStrict(
  req: NextRequest,
  opts: Omit<RateLimitOptions, "failMode">
): Promise<NextResponse | null> {
  return enforceRateLimit(req, { ...opts, failMode: "closed" })
}
