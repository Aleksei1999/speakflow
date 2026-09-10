// Глобальный Redis-кеш (Upstash) поверх loader'ов: в отличие от unstable_cache
// переживает deploy и общий для всех регионов. Только для статичных
// справочников, per-user данные сюда не кладём. Fail-open: Redis недоступен → loader.
import "server-only"
import { Redis } from "@upstash/redis"

let _redis: Redis | null = null
let _initFailed = false

function getRedis(): Redis | null {
  if (_redis) return _redis
  if (_initFailed) return null
  // Vercel marketplace prefix — KV_REST_*; standalone Upstash — UPSTASH_REDIS_*.
  // Поддерживаем оба, чтобы тот же код жил локально и в проде.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    _initFailed = true
    return null
  }
  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch (e) {
    console.warn(
      "[redis-cache] failed to init Upstash Redis:",
      (e as Error)?.message
    )
    _initFailed = true
    return null
  }
}

// Глобальный префикс — изолирует от @upstash/ratelimit и других
// клиентов, которые могут писать в тот же физический Redis.
const KEY_PREFIX = "cache:speakflow:"

/**
 * Get from Redis или вычисли. На отказ Redis (env пуст / timeout / network) —
 * fallback на прямой вызов loader (fail-open).
 *
 * Сериализация: @upstash/redis сам делает JSON.stringify/parse под капотом,
 * поэтому в Redis объекты летят как сериализованные строки. Это означает:
 *  - Date → строка ISO (нельзя пропустить через cache, если рассчитываешь
 *    на типа Date на выходе; конвертируй вручную)
 *  - Map/Set / undefined / BigInt — теряются (JSON ограничения)
 *  - Функции / классы — теряются
 *  - Number / string / boolean / null / plain object / array — ок
 */
export async function cacheStatic<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>
): Promise<T> {
  const r = getRedis()
  if (!r) return loader()

  const fullKey = KEY_PREFIX + key
  try {
    const cached = await r.get<T>(fullKey)
    if (cached !== null && cached !== undefined) return cached
  } catch (e) {
    console.warn(
      `[redis-cache] get failed for ${key}:`,
      (e as Error)?.message
    )
    return loader()
  }

  const fresh = await loader()
  try {
    // Upstash принимает только JSON-сериализуемое значение или строку.
    // Передаём как есть — клиент сам JSON.stringify сделает.
    await r.setex(fullKey, ttlSec, fresh as unknown as string)
  } catch (e) {
    console.warn(
      `[redis-cache] setex failed for ${key}:`,
      (e as Error)?.message
    )
  }
  return fresh
}
/**
 * Инвалидация по префиксу. KEYS на больших Redis блокирующая — только для
 * редких admin-операций.
 */
export async function invalidateStaticPrefix(prefix: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    const keys = await r.keys(`${KEY_PREFIX}${prefix}*`)
    if (keys.length > 0) {
      // Redis DEL принимает variadic; @upstash/redis тоже.
      await r.del(...(keys as [string, ...string[]]))
    }
  } catch (e) {
    console.warn(
      `[redis-cache] del-prefix failed:`,
      (e as Error)?.message
    )
  }
}

// Ключи в одном месте, чтобы invalidate-сайты не дрейфовали.
export const REDIS_KEYS = {
  achievementDefs: "achievements:definitions",
  leaderboardWeeklyDefault: "leaderboard:weekly:default",
  teachersPublicDefault: "teachers:public:listed:default",
} as const
