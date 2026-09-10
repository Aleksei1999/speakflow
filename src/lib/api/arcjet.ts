// Arcjet поверх Turnstile + rate-limit + CSP: shield (OWASP-атаки),
// detectBot (non-human клиенты) и validateEmail (disposable / no MX).
// Без ARCJET_KEY — fail-open (dev/preview без ключа); в prod ключ обязателен.

import arcjet, { detectBot, shield, validateEmail } from "@arcjet/next"
import { NextRequest, NextResponse } from "next/server"

const ARCJET_KEY = process.env.ARCJET_KEY ?? ""

// Предупреждаем один раз за процесс, чтобы не спамить логи.
let warnedMissingKey = false
function warnOnce(reason: string) {
  if (warnedMissingKey) return
  warnedMissingKey = true
  console.warn(`[arcjet] ${reason} — protection is OFF. Set ARCJET_KEY in env.`)
}

const aj = ARCJET_KEY
  ? arcjet({
      key: ARCJET_KEY,
      // characteristic = identity key для дедупа на стороне Arcjet
      // (sliding-window счётчики у них работают по этим характеристикам).
      // Берём IP — самое стабильное для анонимных endpoint'ов.
      characteristics: ["ip.src"],
      rules: [
        // OWASP-уровневая защита: SQLi / XSS / path-traversal /
        // broken HTTP. LIVE = блокирующий режим.
        shield({ mode: "LIVE" }),
        // Боты — пропускаем поисковики (Google, Yandex, Bing),
        // uptime-monitors (UptimeRobot, Pingdom) и preview-боты
        // (Slack/Telegram/Discord OG-preview). Всё остальное, что
        // Arcjet классифицирует как бота — Deny.
        detectBot({
          mode: "LIVE",
          allow: [
            "CATEGORY:SEARCH_ENGINE",
            "CATEGORY:MONITOR",
            "CATEGORY:PREVIEW",
          ],
        }),
      ],
    })
  : null

// Отдельный инстанс под email-валидацию: проверяем email независимо от
// bot-decision (например, уже авторизованный юзер в teach-apply).
const ajEmail = ARCJET_KEY
  ? arcjet({
      key: ARCJET_KEY,
      characteristics: ["ip.src"],
      rules: [
        validateEmail({
          mode: "LIVE",
          deny: ["INVALID", "DISPOSABLE", "NO_MX_RECORDS"],
        }),
      ],
    })
  : null

// Вызывать ПЕРВЫМ в handler'е (до rate-limit / auth / Turnstile), чтобы
// дешёвый shield/bot-decision срабатывал раньше Postgres и внешних API.
// Возвращает NextResponse (Deny — caller сразу его возвращает) или null.
// Ошибки самого Arcjet (timeout до Decide API) — fail-open.
export async function protectPublic(req: NextRequest): Promise<NextResponse | null> {
  if (!aj) {
    warnOnce("ARCJET_KEY missing")
    return null
  }

  let decision
  try {
    decision = await aj.protect(req)
  } catch (err) {
    console.warn("[arcjet] protect() threw, fail-open:", err)
    return null
  }

  if (decision.isErrored()) {
    console.warn("[arcjet] decision errored, fail-open:", decision.reason)
    return null
  }

  if (decision.isDenied()) {
    const reason = decision.reason
    // Bot / shield → 403; rate-limit (правило не подключено, на всякий случай) → 429.
    const status = reason.isRateLimit() ? 429 : 403
    console.warn(
      `[arcjet] DENY status=${status} bot=${reason.isBot()} shield=${reason.isShield()} ip=${getIpFromReq(req)}`
    )
    // Generic message — никаких Arcjet-specific reasons наружу
    // (чтобы атакующий не подстраивался под классификатор).
    return NextResponse.json(
      { error: status === 429 ? "Слишком много запросов" : "Запрос отклонён" },
      { status }
    )
  }

  return null
}

// Возвращает структуру, а не NextResponse — caller сам формулирует 400.
// Без ARCJET_KEY или при network-error — { valid: true } (fail-open).
export async function validateEmailField(
  email: string
): Promise<{ valid: boolean; reason?: "invalid" | "disposable" | "no_mx" | "other" }> {
  if (!ajEmail) {
    warnOnce("ARCJET_KEY missing")
    return { valid: true }
  }

  let decision
  try {
    // Synthetic request: Arcjet требует request-like объект, IP для
    // email-rule не важен.
    decision = await ajEmail.protect(
      {
        headers: new Headers(),
      } as any,
      { email }
    )
  } catch (err) {
    console.warn("[arcjet] validateEmail() threw, fail-open:", err)
    return { valid: true }
  }

  if (decision.isErrored()) {
    console.warn("[arcjet] email decision errored, fail-open:", decision.reason)
    return { valid: true }
  }

  if (decision.isDenied()) {
    // fallback "other" — защита от расширения enum'а Arcjet в будущем.
    const r = decision.reason
    if (r.isEmail()) {
      const types: string[] = (r as any).emailTypes ?? []
      let reason: "invalid" | "disposable" | "no_mx" | "other" = "other"
      if (types.includes("INVALID")) reason = "invalid"
      else if (types.includes("DISPOSABLE")) reason = "disposable"
      else if (types.includes("NO_MX_RECORDS")) reason = "no_mx"
      console.warn(`[arcjet] email DENY reason=${reason} types=${types.join(",")}`)
      return { valid: false, reason }
    }
    return { valid: false, reason: "other" }
  }

  return { valid: true }
}

// Локальный helper — Arcjet сам читает IP из request, но для лога удобно.
function getIpFromReq(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}
