// ---------------------------------------------------------------------------
// HMAC-подписанный CSRF-state для Google OAuth flow.
//
// В /api/google/oauth/start мы генерим state с зашитым user_id и nonce,
// а в callback проверяем подпись и валидность TTL. Это защищает от:
//   • CSRF (без валидного state callback просто откажет);
//   • подстановки чужого user_id (state подписан секретом).
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

const STATE_TTL_MS = 10 * 60 * 1000 // 10 минут

interface StatePayload {
  userId: string
  ts: number
  nonce: string
}

function getSecret(): string {
  // Используем существующий RW_ROLE_COOKIE_SECRET (проект уже требует его в prod).
  // Отдельный env заводить не нужно — семантика ровно та же: HMAC-подпись.
  const secret =
    process.env.RW_ROLE_COOKIE_SECRET?.trim() ||
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!secret) {
    throw new Error(
      'No HMAC secret available: set RW_ROLE_COOKIE_SECRET (or INTERNAL_API_SECRET) for OAuth state signing',
    )
  }
  return secret
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function signState(userId: string): string {
  const payload: StatePayload = {
    userId,
    ts: Date.now(),
    nonce: randomBytes(12).toString('hex'),
  }
  const body = b64urlEncode(JSON.stringify(payload))
  const sig = b64urlEncode(createHmac('sha256', getSecret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyState(state: string): StatePayload | null {
  if (!state || typeof state !== 'string') return null
  const idx = state.lastIndexOf('.')
  if (idx <= 0) return null
  const body = state.slice(0, idx)
  const sig = state.slice(idx + 1)

  const expected = createHmac('sha256', getSecret()).update(body).digest()
  let provided: Buffer
  try {
    provided = b64urlDecode(sig)
  } catch {
    return null
  }
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  let parsed: StatePayload
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf-8')) as StatePayload
  } catch {
    return null
  }
  if (!parsed || typeof parsed.userId !== 'string' || typeof parsed.ts !== 'number') return null
  if (Date.now() - parsed.ts > STATE_TTL_MS) return null
  return parsed
}
