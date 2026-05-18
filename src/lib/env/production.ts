/**
 * Warns when production is missing security-related env vars.
 * Called once at server startup (instrumentation).
 */

const REQUIRED_IN_PRODUCTION = [
  "CRON_SECRET",
  "INTERNAL_API_SECRET",
  "TELEGRAM_WEBHOOK_SECRET",
  "RW_ROLE_COOKIE_SECRET",
] as const

const RECOMMENDED_IN_PRODUCTION = [
  "ARCJET_KEY",
  "TURNSTILE_SECRET_KEY",
  "VIRUSTOTAL_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return

  const missingRequired = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim())
  const missingRecommended = RECOMMENDED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim())

  if (missingRequired.length > 0) {
    console.error(
      "[env] Missing required production secrets:",
      missingRequired.join(", ")
    )
  }

  if (missingRecommended.length > 0) {
    console.warn(
      "[env] Missing recommended production config (some protections fail-open):",
      missingRecommended.join(", ")
    )
  }
}
