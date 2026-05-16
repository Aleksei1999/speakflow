import * as jose from 'jose'
import { JITSI_CONFIG, validateJitsiConfig } from './config'

export interface JitsiUser {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
  /** Преподаватель получает права модератора */
  isModerator: boolean
}

export interface JitsiTokenOptions {
  /** Время старта урока. Используется для динамического exp. */
  scheduledAt?: string | Date | null
  /** Длительность урока в минутах. Используется для exp. */
  durationMinutes?: number | null
}

const DEFAULT_EXP_HOURS = 2
const POST_LESSON_BUFFER_MIN = 30
const MIN_TOKEN_LIFETIME_SEC = 5 * 60

/**
 * Динамический exp = min(now + 2ч, scheduledEnd + 30мин). Если урок
 * короткий и в середине — токен живёт ровно до конца. Минимум — 5 минут
 * от сейчас, чтобы не выдавать заведомо мёртвый токен.
 */
function computeExpSeconds(opts?: JitsiTokenOptions): number {
  const nowSec = Math.floor(Date.now() / 1000)
  const default2h = nowSec + DEFAULT_EXP_HOURS * 60 * 60

  if (!opts?.scheduledAt || !opts?.durationMinutes) return default2h

  const scheduledMs =
    opts.scheduledAt instanceof Date
      ? opts.scheduledAt.getTime()
      : new Date(opts.scheduledAt).getTime()
  if (!Number.isFinite(scheduledMs)) return default2h

  const lessonEndSec = Math.floor(
    (scheduledMs + (opts.durationMinutes + POST_LESSON_BUFFER_MIN) * 60 * 1000) /
      1000
  )

  const capped = Math.min(default2h, lessonEndSec)
  return Math.max(capped, nowSec + MIN_TOKEN_LIFETIME_SEC)
}

/** Генерирует JWT для Jitsi Meet с динамическим exp по длительности урока. */
export async function generateJitsiToken(
  roomName: string,
  user: JitsiUser,
  opts?: JitsiTokenOptions
): Promise<string> {
  validateJitsiConfig()

  if (!roomName || typeof roomName !== 'string') {
    throw new Error('roomName обязателен')
  }

  const secret = new TextEncoder().encode(JITSI_CONFIG.jwtSecret)
  const exp = computeExpSeconds(opts)

  const token = await new jose.SignJWT({
    context: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl ?? undefined,
        affiliation: user.isModerator ? 'owner' : 'member',
      },
    },
    room: roomName,
    moderator: user.isModerator,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(JITSI_CONFIG.appId)
    .setSubject(JITSI_CONFIG.domain)
    .setAudience('jitsi')
    .setIssuedAt()
    // nbf = "not before" — защита от clock-skew replay. Prosody-jwt опционально
    // верифицирует claim; отсутствие безопасно, наличие не ломает рантайм.
    .setNotBefore(Math.floor(Date.now() / 1000))
    .setExpirationTime(exp)
    .sign(secret)

  return token
}
