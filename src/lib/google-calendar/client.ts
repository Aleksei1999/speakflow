// ---------------------------------------------------------------------------
// Google Calendar API v3 helper.
//
// Отвечает за:
//   1. Хранение/обновление OAuth-токенов в `google_calendar_tokens`
//      (через service_role — обычному authenticated таблица закрыта).
//   2. Автоматический refresh access_token когда истёк.
//   3. Тонкий враппер над Calendar API v3 (`events.list`).
//
// Двусторонней записи НЕТ — только read-only.
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// Скоуп: read+write на события пользователя (нужно для pushEventToGoogle),
// плюс openid+email чтобы получить google_email для отображения в UI.
// NB: старые токены, выданные с `.readonly`, будут падать при POST — pushEventToGoogle
// ловит insufficientPermissions и кидает 'google-write-scope-missing'; UI должен
// подсказать пользователю переподключить календарь (повторный OAuth flow).
export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
]

// Небольшой запас, чтобы не улететь в 401 из-за секундного дрейфа часов.
const TOKEN_REFRESH_SKEW_MS = 60_000

export interface GoogleCalendarEvent {
  id: string
  summary?: string | null
  description?: string | null
  location?: string | null
  start?: { dateTime?: string; date?: string; timeZone?: string } | null
  end?: { dateTime?: string; date?: string; timeZone?: string } | null
  attendees?: Array<{ email?: string }> | null
  hangoutLink?: string | null
  htmlLink?: string | null
  updated?: string | null
  status?: string | null
}

interface StoredToken {
  user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  google_email: string | null
  calendar_id: string
  synced_at: string | null
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type?: string
  id_token?: string
}

// google_calendar_tokens не в generated Database типах ещё —
// миграция свежая, gen:types не прогонялся. Работаем через as any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

function requireOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured: set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET')
  }
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is required to build Google OAuth redirect URI')
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl.replace(/\/+$/, '')}/api/google/oauth/callback`,
  }
}

/**
 * Строит URL для перенаправления пользователя на Google consent screen.
 * `state` — HMAC-подписанный CSRF-токен (см. /api/google/oauth/start).
 */
export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = requireOAuthConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',   // нужен refresh_token
    prompt: 'consent',        // форсим consent, иначе повторный OAuth не отдаёт refresh_token
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Обменивает authorization code, полученный из callback, на access+refresh токены.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireOAuthConfig()
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google token exchange failed (${res.status}): ${text}`)
  }
  return (await res.json()) as GoogleTokenResponse
}

/** Достаёт email из id_token (JWT payload, base64url middle segment). */
export function decodeEmailFromIdToken(idToken: string | undefined | null): string | null {
  if (!idToken) return null
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf-8',
    )
    const parsed = JSON.parse(payload) as { email?: string }
    return parsed.email ?? null
  } catch {
    return null
  }
}

/**
 * Сохраняет/обновляет OAuth-токены в БД (upsert по user_id).
 * refresh_token может отсутствовать в повторном OAuth-flow — тогда
 * оставляем старый (иначе потеряем возможность обновлять access).
 */
export async function saveTokensForUser(params: {
  userId: string
  accessToken: string
  refreshToken?: string
  expiresIn: number
  googleEmail?: string | null
  calendarId?: string
}): Promise<void> {
  const admin = createAdminClient() as UntypedSupabase
  const expiresAt = new Date(Date.now() + params.expiresIn * 1000).toISOString()

  // Если refresh_token не пришёл (Google не всегда его отдаёт при re-consent
  // без prompt=consent, но мы форсим consent — на всякий случай fallback).
  let refreshToken = params.refreshToken
  if (!refreshToken) {
    const { data: existing } = await admin
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', params.userId)
      .maybeSingle()
    refreshToken = existing?.refresh_token
    if (!refreshToken) {
      throw new Error('No refresh_token returned by Google and none stored — cannot save tokens')
    }
  }

  const { error } = await admin
    .from('google_calendar_tokens')
    .upsert(
      {
        user_id: params.userId,
        access_token: params.accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        google_email: params.googleEmail ?? null,
        calendar_id: params.calendarId ?? 'primary',
      },
      { onConflict: 'user_id' },
    )
  if (error) throw new Error(`saveTokensForUser: ${error.message}`)
}

async function loadToken(userId: string): Promise<StoredToken | null> {
  const admin = createAdminClient() as UntypedSupabase
  const { data, error } = await admin
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`loadToken: ${error.message}`)
  return (data as StoredToken | null) ?? null
}

async function refreshAccessToken(token: StoredToken): Promise<StoredToken> {
  const { clientId, clientSecret } = requireOAuthConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google refresh_token failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as GoogleTokenResponse
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()

  const admin = createAdminClient() as UntypedSupabase
  const { error } = await admin
    .from('google_calendar_tokens')
    .update({
      access_token: json.access_token,
      token_expires_at: expiresAt,
    })
    .eq('user_id', token.user_id)
  if (error) throw new Error(`refreshAccessToken: db update failed: ${error.message}`)

  return { ...token, access_token: json.access_token, token_expires_at: expiresAt }
}

/**
 * Возвращает валидный access_token, авто-refresh если истёк.
 * Возвращает null если у юзера вообще нет привязанного календаря.
 */
export async function getAccessToken(userId: string): Promise<{
  accessToken: string
  calendarId: string
  googleEmail: string | null
} | null> {
  const token = await loadToken(userId)
  if (!token) return null

  const expiresAt = new Date(token.token_expires_at).getTime()
  const needsRefresh = Number.isFinite(expiresAt) && expiresAt - Date.now() < TOKEN_REFRESH_SKEW_MS
  const fresh = needsRefresh ? await refreshAccessToken(token) : token

  return {
    accessToken: fresh.access_token,
    calendarId: fresh.calendar_id,
    googleEmail: fresh.google_email,
  }
}

/**
 * Тонкий враппер над `events.list`. Возвращает нормализованный массив событий
 * за интервал [timeMin, timeMax]. Отменённые события (`status = 'cancelled'`)
 * отфильтровываются.
 */
export async function listEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleCalendarEvent[]> {
  const auth = await getAccessToken(userId)
  if (!auth) return []

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',       // разворачиваем recurring
    orderBy: 'startTime',
    maxResults: '250',
  })
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events?${params}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    // ВАЖНО: не кешируем — always-fresh
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google Calendar events.list failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as { items?: GoogleCalendarEvent[] }
  return (json.items ?? []).filter((e) => e.status !== 'cancelled' && !!e.id)
}

/**
 * Пушит новое событие в Google Calendar юзера.
 * Возвращает id созданного события Google, либо null если у юзера нет привязки.
 * Кидает Error при HTTP-ошибке (вызывающий сам решает — залогировать или пробросить).
 *
 * НЕ пересекается с read-only listEvents-веткой: чтобы иметь право писать,
 * OAuth-скоуп должен включать `calendar.events` (не `.readonly`). Если у пользователя
 * старый refresh_token с readonly-скоупом — Google вернёт 403 insufficientPermissions,
 * мы это ловим и превращаем в Error `google-write-scope-missing`, чтобы UI мог
 * подсказать пользователю переподключить календарь.
 */
export async function pushEventToGoogle(
  userId: string,
  params: {
    summary: string
    startISO: string
    endISO: string
    description?: string
    /** private-namespaced ключи; читаются через events.get(...).extendedProperties.private */
    extendedProps?: Record<string, string>
  },
): Promise<string | null> {
  const auth = await getAccessToken(userId)
  if (!auth) return null

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`
  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description ?? undefined,
    start: { dateTime: params.startISO },
    end: { dateTime: params.endISO },
  }
  if (params.extendedProps && Object.keys(params.extendedProps).length > 0) {
    body.extendedProperties = { private: params.extendedProps }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 403 && /insufficient/i.test(text)) {
      throw new Error('google-write-scope-missing')
    }
    throw new Error(`Google Calendar events.insert failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as { id?: string }
  return json.id ?? null
}

/**
 * Проверяет, есть ли в Google Calendar пользователя события, пересекающиеся
 * с интервалом [startISO, endISO). Fail-soft: если у пользователя нет
 * привязанного календаря / API упал / токены битые — возвращает `false`
 * (мы не хотим блокировать создание урока из-за проблем с Google).
 *
 * ПРИМЕЧАНИЕ. listEvents уже фильтрует cancelled и разворачивает recurring
 * (singleEvents=true), поэтому здесь достаточно проверить непустоту
 * результата и корректно интерпретировать полу-открытый интервал:
 *   busy ⇔ event.start < endISO AND event.end > startISO
 * (Google возвращает события, что-хоть-как пересекают [timeMin,timeMax];
 * cross-check по секундам не помешает — на границе события не должны
 * считаться конфликтом.)
 */
export async function isSlotBusyInGoogle(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<boolean> {
  try {
    const startMs = Date.parse(startISO)
    const endMs = Date.parse(endISO)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return false
    }
    const events = await listEvents(userId, new Date(startMs), new Date(endMs))
    if (events.length === 0) return false
    for (const e of events) {
      const evStartRaw = e.start?.dateTime ?? e.start?.date
      const evEndRaw = e.end?.dateTime ?? e.end?.date
      if (!evStartRaw || !evEndRaw) continue
      const evStart = Date.parse(evStartRaw)
      const evEnd = Date.parse(evEndRaw)
      if (!Number.isFinite(evStart) || !Number.isFinite(evEnd)) continue
      // Полу-открытые интервалы: касание на границе НЕ считается конфликтом.
      if (evStart < endMs && evEnd > startMs) return true
    }
    return false
  } catch (e) {
    // Fail-soft: не блокируем создание урока из-за проблем с Google API.
    console.error('[isSlotBusyInGoogle] fail-soft', e)
    return false
  }
}

/**
 * Удаляет событие в Google Calendar по id. Возвращает `true` при успехе
 * (или если события уже нет — 404/410), `false` при других ошибках.
 * Fail-soft: не кидает Error, чтобы cancelLesson всегда мог удалить строку
 * из БД, даже если Google недоступен.
 */
export async function deleteEventFromGoogle(userId: string, eventId: string): Promise<boolean> {
  if (!eventId) return false
  try {
    const auth = await getAccessToken(userId)
    if (!auth) return false
    const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: 'no-store',
    })
    // 204 — удалено; 404/410 — уже нет.
    if (res.status === 204 || res.status === 404 || res.status === 410) return true
    const text = await res.text().catch(() => '')
    console.error(`[deleteEventFromGoogle] ${res.status}: ${text}`)
    return false
  } catch (e) {
    console.error('[deleteEventFromGoogle] failed', e)
    return false
  }
}

/** Проставляет synced_at = now() после успешного sync. */
export async function markSynced(userId: string): Promise<void> {
  const admin = createAdminClient() as UntypedSupabase
  const { error } = await admin
    .from('google_calendar_tokens')
    .update({ synced_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) throw new Error(`markSynced: ${error.message}`)
}

/** Существует ли у юзера привязанный календарь. Дёшево (без чтения секретов). */
export async function hasGoogleCalendar(userId: string): Promise<{
  connected: boolean
  googleEmail: string | null
  syncedAt: string | null
}> {
  const admin = createAdminClient() as UntypedSupabase
  const { data, error } = await admin
    .from('google_calendar_status')
    .select('google_email, synced_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { connected: false, googleEmail: null, syncedAt: null }
  if (!data) return { connected: false, googleEmail: null, syncedAt: null }
  return {
    connected: true,
    googleEmail: (data as { google_email: string | null }).google_email,
    syncedAt: (data as { synced_at: string | null }).synced_at,
  }
}
