/**
 * Signed cookie cache for the user's role.
 *
 * Why: middleware runs on every non-static request and currently does a
 * Supabase round-trip to `profiles` for the role. Roles change rarely
 * (admin approves a teacher application, signup), so we cache the role in
 * an HMAC-SHA256-signed cookie with a short TTL (10 minutes). On a hit we
 * skip the DB query entirely.
 *
 * Format (cookie value):
 *   base64url(JSON({ uid, role, exp })) + "." + base64url(HMAC_SHA256(payload, secret))
 *
 * - exp is a unix-seconds timestamp.
 * - HMAC is computed via Web Crypto API (Edge-runtime safe, no jose dep).
 * - If RW_ROLE_COOKIE_SECRET is missing or anything throws, helpers return
 *   null / silently no-op so we never break the auth flow — we just fall
 *   back to the original DB-backed path.
 */

import type { NextRequest, NextResponse } from 'next/server'

export const ROLE_COOKIE_NAME = 'rwen_role'
export const ROLE_COOKIE_TTL_SECONDS = 10 * 60 // 10 minutes

type RolePayload = {
  uid: string
  role: string | null
  exp: number
}

// --- base64url helpers --------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  // btoa is available in Edge runtime
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function strToBytes(s: string): Uint8Array<ArrayBuffer> {
  // Copy into an explicit ArrayBuffer-backed view so Web Crypto's
  // BufferSource (which excludes SharedArrayBuffer) is satisfied under
  // the Next.js TS lib settings.
  const enc = new TextEncoder().encode(s)
  const buf = new ArrayBuffer(enc.byteLength)
  const view = new Uint8Array(buf)
  view.set(enc)
  return view
}

function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b)
}

// Constant-time equality on two byte arrays. Avoids leaking timing info on
// HMAC comparison (Web Crypto verify would also work but this is simpler
// for the encoded path).
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

// --- HMAC ---------------------------------------------------------------

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, strToBytes(data))
  return new Uint8Array(sig)
}

// --- Public API ---------------------------------------------------------

function getSecret(): string | null {
  const s = process.env.RW_ROLE_COOKIE_SECRET
  if (!s || s.length < 16) return null
  return s
}

/**
 * Read + verify the role cookie. Returns the cached role (which may be
 * `null` for users without a profile row) only when:
 *   - secret is configured,
 *   - signature matches,
 *   - exp is in the future,
 *   - uid in payload matches the JWT's user id.
 * Otherwise returns `undefined` — caller must fall back to DB.
 */
export async function readRoleCookie(
  request: NextRequest,
  userId: string
): Promise<string | null | undefined> {
  const secret = getSecret()
  if (!secret) return undefined

  const raw = request.cookies.get(ROLE_COOKIE_NAME)?.value
  if (!raw) return undefined

  const dot = raw.indexOf('.')
  if (dot <= 0 || dot === raw.length - 1) return undefined
  const payloadB64 = raw.slice(0, dot)
  const sigB64 = raw.slice(dot + 1)

  try {
    const expected = await hmacSign(secret, payloadB64)
    const got = base64UrlToBytes(sigB64)
    if (!timingSafeEqual(expected, got)) return undefined

    const payload = JSON.parse(bytesToStr(base64UrlToBytes(payloadB64))) as RolePayload
    if (typeof payload?.uid !== 'string' || typeof payload?.exp !== 'number') return undefined
    if (payload.uid !== userId) return undefined
    if (payload.exp <= Math.floor(Date.now() / 1000)) return undefined
    if (payload.role !== null && typeof payload.role !== 'string') return undefined

    return payload.role
  } catch {
    return undefined
  }
}

/**
 * Sign the {uid, role, exp} payload and attach it to the response. Silent
 * no-op when the secret env is missing or signing throws.
 */
export async function writeRoleCookie(
  response: NextResponse,
  userId: string,
  role: string | null
): Promise<void> {
  const secret = getSecret()
  if (!secret) return

  try {
    const payload: RolePayload = {
      uid: userId,
      role,
      exp: Math.floor(Date.now() / 1000) + ROLE_COOKIE_TTL_SECONDS,
    }
    const payloadB64 = bytesToBase64Url(strToBytes(JSON.stringify(payload)))
    const sig = await hmacSign(secret, payloadB64)
    const value = `${payloadB64}.${bytesToBase64Url(sig)}`

    response.cookies.set(ROLE_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: ROLE_COOKIE_TTL_SECONDS,
    })
  } catch {
    // swallow — caching is best-effort
  }
}

/**
 * Clear the role cookie (e.g. on sign-out or explicit role change).
 */
export function clearRoleCookie(response: NextResponse): void {
  response.cookies.set(ROLE_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0,
  })
}
