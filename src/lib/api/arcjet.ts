// ---------------------------------------------------------------
// Arcjet — поверх существующей защиты (Turnstile + Postgres/Upstash
// rate-limit + CSP). Покрывает то, чего наш стек не делает:
//
//   1. shield      — детект OWASP-атак (SQLi / XSS-payloads,
//                    path-traversal, broken HTTP) до достижения
//                    бизнес-логики и до Supabase RPC.
//   2. detectBot   — non-human клиенты (curl / python-requests /
//                    scrapy / headless chrome). Search-engine /
//                    uptime / OG-preview боты разрешены явно.
//   3. validateEmail — DISPOSABLE / INVALID / NO_MX_RECORDS,
//                    добавляется в Zod-валидацию там, где аноним
//                    шлёт email (signup, teach-apply, trial, support).
//
// Что мы НЕ берём из Arcjet (намеренно):
//   - rate-limiting: уже есть в src/lib/api/rate-limit.ts
//     (Postgres сейчас, Upstash в параллельной задаче #62).
//   - CAPTCHA: Cloudflare Turnstile стоит на формах.
//   - sensitive-info detection: пока не нужно (нет user-input логов).
//
// Fail-mode: если ARCJET_KEY не задан в env — `protectPublic`
// возвращает null (fail-open). Это нужно для dev/preview без ключа,
// чтобы локальные прогоны не падали. В prod ключ обязан быть.
// ---------------------------------------------------------------

import arcjet, { detectBot, shield, validateEmail } from "@arcjet/next"
import { NextRequest, NextResponse } from "next/server"

const ARCJET_KEY = process.env.ARCJET_KEY ?? ""

// Module-scope flag, чтобы не спамить логи на каждый запрос —
// предупреждаем один раз за процесс / cold-start.
let warnedMissingKey = false
function warnOnce(reason: string) {
  if (warnedMissingKey) return
  warnedMissingKey = true
  console.warn(`[arcjet] ${reason} — protection is OFF. Set ARCJET_KEY in env.`)
}

// ---------------------------------------------------------------
// Основной инстанс: shield + detectBot.
// Если ключ не задан — null, и protectPublic() уходит в fail-open.
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// Отдельный инстанс под email-валидацию. Нужен потому, что мы
// хотим проверять email независимо от bot-decision (например,
// после авторизации, когда user уже в системе и точно человек,
// но всё равно мог ввести disposable-mail для teach-apply).
//
// `deny` = по списку: невалидный синтаксис, disposable провайдер
// (mailinator/tempmail/...), отсутствие MX-записей у домена.
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// protectPublic — основной entry-point для публичных endpoint'ов.
// Вызывается ПЕРВЫМ в handler'е (до rate-limit / auth / Turnstile /
// бизнес-логики), чтобы дешёвый shield/bot-decision срабатывал
// раньше, чем мы тронем Postgres или внешние API.
//
// Возвращает:
//   NextResponse — если Arcjet решил Deny (403 / 429 в зависимости
//                  от причины). Caller должен сразу `return` его.
//   null         — пропустить дальше.
//
// Errors от самого Arcjet (network timeout до Decide API) — fail-open
// через decision.isErrored(). Логируем, но не блокируем — иначе
// первый же тайм-аут уронит весь endpoint.
// ---------------------------------------------------------------
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
    // Differentiate by reason type for accurate HTTP semantics.
    // Bot / shield → 403 (forbidden); rate-limit (we don't ship this rule,
    // но на всякий случай) → 429.
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

// ---------------------------------------------------------------
// validateEmailField — non-blocking helper для интеграции в Zod-валидацию.
// Возвращает структуру, а не NextResponse — caller сам решает, как
// сформулировать 400 (часто хочется специфичное сообщение в зависимости
// от типа field'а: "applicant email" vs "contact email").
//
// При отсутствии ARCJET_KEY возвращает { valid: true } — не блокируем
// signup-flow если интеграция не настроена.
//
// При network-error от Arcjet — { valid: true } (fail-open). Email-проверка
// это nice-to-have, не критический gate.
// ---------------------------------------------------------------
export async function validateEmailField(
  email: string
): Promise<{ valid: boolean; reason?: "invalid" | "disposable" | "no_mx" | "other" }> {
  if (!ajEmail) {
    warnOnce("ARCJET_KEY missing")
    return { valid: true }
  }

  let decision
  try {
    // Synthetic request — мы валидируем не входящий HTTP, а конкретное
    // поле формы. Arcjet API требует request-like объект; собираем
    // минимальный: IP не важен (decision driven by email content).
    decision = await ajEmail.protect(
      {
        headers: new Headers(),
        // ip.src characteristic — unused для email-rule, но runtime
        // ожидает что-то. Передаём заглушку, протокол это терпит.
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
    // Find the email-reason; fallback to "other" if Arcjet категории
    // мы не различили (защищаемся от расширения protocol-enum'а в будущем).
    const r = decision.reason
    if (r.isEmail()) {
      // emailTypes — массив из ArcjetEmailType.
      // Берём первый matched тип в нашем deny-списке.
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
