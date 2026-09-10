import { Redis } from "@upstash/redis"

let redis: Redis | null = null
let checked = false

/** Upstash Redis. Поддерживаем оба набора переменных: Vercel Marketplace (KV_REST_*) и Upstash (UPSTASH_REDIS_REST_*). null — не настроен. */
export function getRedis(): Redis | null {
  if (checked) return redis
  checked = true
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  try {
    redis = new Redis({ url, token })
  } catch (e) {
    console.error("[redis] init failed:", e)
    redis = null
  }
  return redis
}
