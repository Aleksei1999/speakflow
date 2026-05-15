// ---------------------------------------------------------------
// VirusTotal lookup helper.
//
// What it does:
//   - Принимает SHA-256 файла, ходит в VT Public API v3, читает
//     `last_analysis_stats.malicious` — сколько AV-движков уже
//     зарепортили этот хэш как зловред.
//   - Кэширует результат в Upstash Redis на 7 дней по ключу
//     `vt:<sha256>`. VT free tier — 500 req/day; кэш экономит
//     повторные обращения по тем же файлам.
//   - НЕ загружает файл целиком: только hash lookup. Если хэш
//     не известен VT (404) — verdict='unknown', НЕ блокируем.
//
// Fail-open philosophy:
//   - Нет VIRUSTOTAL_API_KEY → fail-open + одноразовый console.warn.
//   - Сетевой timeout / 5xx / парсинг сломался → fail-open + Sentry
//     breadcrumb. AV-проверка не должна ломать прод upload-flow.
//
// Cost model (VT public free):
//   - 4 req/min, 500 req/day, 15.5k req/month.
//   - 7-day cache: один и тот же файл ест квоту 1 раз в неделю.
//   - При 100 uploads/day среднестатистических (≈70% повторных хэшей
//     через cache) — ~30 запросов/день. Comfortable margin.
//
// Usage:
//   import { scanFileHash } from "@/lib/api/virustotal"
//   const verdict = await scanFileHash(sha256)
//   if (verdict.verdict === "malicious") { ...reject... }
// ---------------------------------------------------------------

import { Redis } from "@upstash/redis"
import * as Sentry from "@sentry/nextjs"

export type ScanVerdict = "clean" | "malicious" | "unknown"

export interface ScanResult {
  verdict: ScanVerdict
  /** Сколько AV-движков отметили файл как malicious. Undefined для 'unknown'. */
  detections?: number
  /** True если результат пришёл из cache (для метрик). */
  cached?: boolean
}

const CACHE_PREFIX = "vt:"
const CACHE_TTL_SECONDS = 7 * 24 * 3600 // 7 дней
const VT_API_URL = "https://www.virustotal.com/api/v3/files/"
const NETWORK_TIMEOUT_MS = 3000
const MALICIOUS_THRESHOLD = 3 // ≥3 движков → реджектим

// ---------------------------------------------------------------
// Redis (re-uses the same Upstash creds as rate-limit.ts).
// ---------------------------------------------------------------

let _redisChecked = false
let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redisChecked) return _redis
  _redisChecked = true
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
    console.warn(
      "[virustotal] failed to init Upstash Redis:",
      (e as Error)?.message
    )
    _redis = null
    return null
  }
}

// ---------------------------------------------------------------
// One-shot warning for missing API key
// ---------------------------------------------------------------

let _missingKeyWarned = false
function warnMissingKey(): void {
  if (_missingKeyWarned) return
  _missingKeyWarned = true
  console.warn(
    "[virustotal] VIRUSTOTAL_API_KEY is not set — AV scan is in fail-open mode. " +
      "Get a free key at https://virustotal.com/gui/my-apikey."
  )
}

// ---------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------

type CachedShape = { verdict: ScanVerdict; detections?: number }

async function readCache(sha256: string): Promise<CachedShape | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get<CachedShape | string>(CACHE_PREFIX + sha256)
    if (!raw) return null
    // Upstash SDK иногда возвращает уже распарсенный JSON, иногда строку.
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as CachedShape
      } catch {
        return null
      }
    }
    if (
      typeof raw === "object" &&
      raw !== null &&
      typeof (raw as CachedShape).verdict === "string"
    ) {
      return raw as CachedShape
    }
    return null
  } catch (e) {
    Sentry.addBreadcrumb({
      category: "virustotal",
      level: "warning",
      message: "cache read failed",
      data: { error: (e as Error)?.message },
    })
    return null
  }
}

async function writeCache(
  sha256: string,
  value: CachedShape
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(CACHE_PREFIX + sha256, JSON.stringify(value), {
      ex: CACHE_TTL_SECONDS,
    })
  } catch (e) {
    Sentry.addBreadcrumb({
      category: "virustotal",
      level: "warning",
      message: "cache write failed",
      data: { error: (e as Error)?.message },
    })
  }
}

// ---------------------------------------------------------------
// VirusTotal API call (with timeout)
// ---------------------------------------------------------------

interface VTResponse {
  data?: {
    attributes?: {
      last_analysis_stats?: {
        malicious?: number
        suspicious?: number
        harmless?: number
        undetected?: number
      }
    }
  }
}

async function queryVT(
  sha256: string,
  apiKey: string
): Promise<ScanResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
  try {
    const res = await fetch(VT_API_URL + sha256, {
      method: "GET",
      headers: {
        "x-apikey": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
    // 404 → хэш неизвестен VT (никто его раньше не сабмитил).
    if (res.status === 404) {
      return { verdict: "unknown" }
    }
    // Rate limit / server error → fail-open, не блочим upload.
    if (!res.ok) {
      Sentry.addBreadcrumb({
        category: "virustotal",
        level: "warning",
        message: "VT API non-OK",
        data: { status: res.status },
      })
      return { verdict: "unknown" }
    }
    const json = (await res.json()) as VTResponse
    const stats = json?.data?.attributes?.last_analysis_stats
    const malicious = Number(stats?.malicious ?? 0)
    if (malicious >= MALICIOUS_THRESHOLD) {
      return { verdict: "malicious", detections: malicious }
    }
    return { verdict: "clean", detections: malicious }
  } catch (e) {
    // Timeout, DNS, TLS — что угодно. Fail-open.
    Sentry.addBreadcrumb({
      category: "virustotal",
      level: "warning",
      message: "VT API request failed",
      data: { error: (e as Error)?.message },
    })
    return { verdict: "unknown" }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * Lookup file hash in VirusTotal. Cached for 7 days in Upstash Redis.
 *
 * Returns:
 *   - 'malicious' если ≥3 AV-движков уже зарепортили этот хэш как зловред,
 *   - 'clean'     если файл в VT и движки не сработали (0–2 detections),
 *   - 'unknown'   если хэш не известен / API недоступен / нет ключа.
 *
 * НИКОГДА не throws. Любая внутренняя ошибка → verdict='unknown'.
 */
export async function scanFileHash(sha256: string): Promise<ScanResult> {
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    // Невалидный hash — ничего не делаем, fail-open.
    return { verdict: "unknown" }
  }
  const hash = sha256.toLowerCase()

  // 1. Cache check (cheap)
  const cached = await readCache(hash)
  if (cached) {
    return {
      verdict: cached.verdict,
      detections: cached.detections,
      cached: true,
    }
  }

  // 2. API key check (fail-open if missing)
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) {
    warnMissingKey()
    return { verdict: "unknown" }
  }

  // 3. Live VT lookup
  const result = await queryVT(hash, apiKey)

  // 4. Cache positive AND negative results
  //    (unknown тоже кэшим — иначе на каждом 404 жжём квоту по новой).
  await writeCache(hash, {
    verdict: result.verdict,
    detections: result.detections,
  })

  return result
}
