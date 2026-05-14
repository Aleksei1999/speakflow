// Cloudflare Turnstile verification.
//
// Клиент рендерит виджет → получает короткоживущий token → шлёт его
// в POST вместе с формой → сервер дёргает Cloudflare для проверки.
//
// Включается только если задан TURNSTILE_SECRET_KEY. Без него
// verifyTurnstile() пропускает запрос (для локальной разработки и
// если решим временно отключить виджет).

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export interface TurnstileResult {
  ok: boolean
  /** Причина если ok=false. Логируем для отладки, юзеру не показываем. */
  reason?: string
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Виджет ещё не настроен / отключён.
    return { ok: true, reason: "disabled" }
  }
  if (!token) {
    return { ok: false, reason: "missing_token" }
  }

  const body = new URLSearchParams()
  body.set("secret", secret)
  body.set("response", token)
  if (remoteIp) body.set("remoteip", remoteIp)

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      // Если CF не ответит за 5 сек — считаем что не прошёл.
      // Лучше отказать честному юзеру, чем пропустить бота.
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return { ok: false, reason: `http_${res.status}` }
    const data = (await res.json()) as {
      success?: boolean
      "error-codes"?: string[]
    }
    if (data.success) return { ok: true }
    return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "rejected" }
  } catch (e: any) {
    return { ok: false, reason: `network: ${e?.message ?? "unknown"}` }
  }
}
