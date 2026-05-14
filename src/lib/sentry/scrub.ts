// Шаги очистки PII перед отправкой в Sentry. Применяем на client + server.
//
// Что выкидываем:
//   - email (любое поле где значение похоже на email)
//   - phone
//   - токены (Bearer/JWT-подобные, Supabase access_token)
//   - payment metadata (yookassa secret/auth, card info)
//   - cookie / authorization headers (Sentry HTTP integration их по дефолту собирает)

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const PHONE_RE = /(?:\+?\d[\s\-().]?){10,}/g
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi
const SUPABASE_KEY_RE = /sbp_[A-Za-z0-9]{32,}|sb_[A-Za-z0-9-]{20,}/g
const SK_RE = /\b(sk_live|sk_test|pk_live|pk_test|rk_live)_[A-Za-z0-9]+\b/g

const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "passwd",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "x-api-key",
  "api_key",
  "captcha_token",
  "captchatoken",
  "turnstile_token",
  "turnstiletoken",
  "phone",
  "email",
  "first_name",
  "last_name",
  "full_name",
  "telegram_chat_id",
  "yookassa_secret",
  "yookassa_payment_id",
  "card",
  "card_number",
  "cvv",
])

function maskString(s: string): string {
  if (!s) return s
  return s
    .replace(JWT_RE, "[redacted-jwt]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(SUPABASE_KEY_RE, "[redacted-sb-key]")
    .replace(SK_RE, "[redacted-sk]")
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]")
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (typeof value === "string") return maskString(value)
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELD_NAMES.has(k.toLowerCase())) {
        out[k] = "[redacted]"
      } else {
        out[k] = scrubValue(v, depth + 1)
      }
    }
    return out
  }
  return value
}

/** Передаётся в Sentry.init({ beforeSend }). Чистит event перед отправкой. */
export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  return scrubValue(event) as T
}

/** Передаётся в Sentry.init({ beforeBreadcrumb }). Чистит breadcrumb. */
export function scrubSentryBreadcrumb<T extends Record<string, any>>(breadcrumb: T): T {
  return scrubValue(breadcrumb) as T
}
