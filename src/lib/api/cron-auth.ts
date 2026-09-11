import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"

/** Bearer CRON_SECRET, сравнение постоянного времени. Без секрета в env — всегда false. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get("authorization") ?? ""
  if (!secret || !header.startsWith("Bearer ")) return false
  const given = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
