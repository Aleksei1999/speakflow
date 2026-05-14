// Шаги очистки PII перед отправкой в Sentry. Применяем на client + server.
//
// Что выкидываем:
//   - email (любое поле где значение похоже на email)
//   - phone
//   - токены: Bearer / JWT (eyJ.) / Supabase service / OpenAI sk-... / sk_live|test
//   - YooKassa: secret, идемпотентность, payment_method_data, confirmation/payment токены,
//     данные карты (first6/last4/expiry_*), recipient
//   - Telegram bot-token (формат 1234567890:AA…)
//   - cookie / authorization headers (Sentry HTTP integration их по дефолту собирает)
//
// Один pass через scrubValue:
//   • совпадение по имени поля (case-insensitive) → значение заменяется на "[redacted]" целиком
//   • совпадение по regex внутри строки → подстрока заменяется на "[redacted-<kind>]"
//
// Все regex написаны так, чтобы быть idempotent (повторный pass не плодит мусор).

// --- Regex: порядок важен. Сначала идут более специфичные форматы, потом общие. ---

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// Phone: ≥10 цифр с разделителями. Допускаем многосимвольные разделители
// (`+7 (916) 123-45-67`: между цифрами может быть `) ` или ` (`).
// `\+?` опционально в начале, далее 10+ повторов «возможные разделители + цифра».
const PHONE_RE = /\+?\d(?:[\s\-().]{0,3}\d){9,}/g

// JWT: header.payload.signature. eyJ-prefix (base64url для {"...).
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g

// Bearer/basic auth header values.
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const BASIC_RE = /Basic\s+[A-Za-z0-9+/=]{8,}/gi

// Supabase secret/anon keys (sb_*, sbp_*) и legacy sb-{ref}-{slot} cookie value.
const SUPABASE_KEY_RE = /\bsbp_[A-Za-z0-9]{32,}\b|\bsb_[A-Za-z0-9-]{20,}\b/g

// OpenAI: sk-proj-... (новые), sk-svcacct-..., sk-... (legacy). Минимум 20 символов
// после префикса чтобы не цеплять что попало.
const OPENAI_KEY_RE = /\bsk-(?:proj|svcacct|admin)?-?[A-Za-z0-9_-]{20,}\b/g

// Stripe-style live/test ключи (если когда-то появятся).
const SK_RE = /\b(?:sk_live|sk_test|pk_live|pk_test|rk_live|rk_test)_[A-Za-z0-9]{16,}\b/g

// Telegram bot-token: numeric_id:35+chars. Например 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11.
// Намеренно без `\b` слева — токен часто идёт впритык к `bot` в URL'е
// `https://api.telegram.org/bot1234:AAA…/getMe`, где границы слова между `t` и `1` нет.
// `:` + ровно нужная длина суффикса достаточно уникальны.
const TELEGRAM_BOT_TOKEN_RE = /\d{6,}:[A-Za-z0-9_-]{35,}/g

// Платёжные карты: 13–19 цифр с произвольным группированием (Luhn не проверяем —
// false positive здесь дешёвый).
const CARD_PAN_RE = /\b(?:\d[ -]?){13,19}\b/g

// --- Field names. Сравнение case-insensitive по нормализованному ключу. ---

const SENSITIVE_FIELD_NAMES = new Set([
  // Auth / generic secrets
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "id_token",
  // NB: не редактим целиком "session" / "session_id" — Sentry hangs context
  // под этим именем, а реальные secret-токены внутри ловятся вложенными
  // правилами (access_token / refresh_token / cookie / regex).
  "authorization",
  "cookie",
  "set-cookie",
  "x-supabase-auth",
  "sb-access-token",
  "sb-refresh-token",
  "x-api-key",
  "api_key",
  "apikey",
  "captcha_token",
  "captchatoken",
  "turnstile_token",
  "turnstiletoken",

  // PII
  "phone",
  "phone_number",
  "email",
  "email_address",
  "first_name",
  "last_name",
  "full_name",
  "name",

  // Telegram
  "telegram_chat_id",
  "telegram_user_id",
  "tg_chat_id",
  "tg_user_id",
  "telegram_bot_token",
  "bot_token",

  // YooKassa / generic payments
  "yookassa_secret",
  "yookassa_secret_key",
  "yookassa_shop_id",
  "yookassa_payment_id",
  "idempotence_key",
  "idempotence-key",
  "idempotency_key",
  "idempotencykey",
  "payment_method_data",
  "payment_token",
  "confirmation_token",
  "recipient",
  "client_email",

  // Карта (любая система)
  "card",
  "card_number",
  "cardnumber",
  "pan",
  "cvv",
  "cvc",
  "first6",
  "last4",
  "expiry_year",
  "expiry_month",
  "exp_year",
  "exp_month",
])

/** Нормализуем имя поля: lowercase + underscore↔hyphen. */
function isSensitiveField(key: string): boolean {
  const k = key.toLowerCase()
  if (SENSITIVE_FIELD_NAMES.has(k)) return true
  // Допускаем варианты с другим разделителем (idempotency-key vs idempotency_key).
  if (SENSITIVE_FIELD_NAMES.has(k.replace(/-/g, "_"))) return true
  if (SENSITIVE_FIELD_NAMES.has(k.replace(/_/g, "-"))) return true
  return false
}

function maskString(s: string): string {
  if (!s) return s
  // Порядок: длинные/специфичные форматы первыми, чтобы их не съел общий PHONE_RE.
  return s
    .replace(JWT_RE, "[redacted-jwt]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(BASIC_RE, "Basic [redacted]")
    .replace(SUPABASE_KEY_RE, "[redacted-sb-key]")
    .replace(OPENAI_KEY_RE, "[redacted-openai-key]")
    .replace(SK_RE, "[redacted-sk]")
    .replace(TELEGRAM_BOT_TOKEN_RE, "[redacted-tg-bot-token]")
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(CARD_PAN_RE, "[redacted-card]")
    .replace(PHONE_RE, "[redacted-phone]")
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (typeof value === "string") return maskString(value)
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveField(k)) {
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

// Экспорт для self-tests / unit-tests. Не должен использоваться в проде.
export const __testing = {
  maskString,
  scrubValue,
  isSensitiveField,
  SENSITIVE_FIELD_NAMES,
}
