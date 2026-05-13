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
const MIN_TOKEN_LIFETIME_SEC = 5 * 60 // защитный пол на 5 минут

/**
 * Динамический exp = МИНИМУМ из (сейчас + 2ч) и (scheduledEnd + 30мин).
 * Раньше использовался max() — для далеко запланированных уроков токен
 * жил сутками, leak → модератор на сутки. Теперь cap по концу урока:
 *   • 50-мин урок в середине → ~45 мин жизни токена
 *   • Только что вошли → весь урок + 30 мин
 *   • Долгий 90-мин урок → up to default2h, не больше
 * Floor MIN_TOKEN_LIFETIME_SEC чтобы не выдавать заведомо мёртвый токен.
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

  // Cap по концу урока, но не меньше MIN_TOKEN_LIFETIME_SEC от сейчас.
  const capped = Math.min(default2h, lessonEndSec)
  return Math.max(capped, nowSec + MIN_TOKEN_LIFETIME_SEC)
}

/**
 * Генерация JWT-токена для Jitsi Meet.
 *
 * exp вычисляется динамически от длительности урока, чтобы токен
 * пережил весь урок даже если юзер открыл вкладку за час до начала.
 * Минимум 2 часа от момента подписи.
 */
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
    .setExpirationTime(exp)
    .sign(secret)

  return token
}
