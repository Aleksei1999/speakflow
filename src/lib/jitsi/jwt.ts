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

/**
 * Генерация JWT-токена для Jitsi Meet.
 *
 * Стандартные claims для Jitsi JWT:
 * - iss  -- appId (JITSI_JWT_APP_ID)
 * - sub  -- домен Jitsi
 * - aud  -- "jitsi" (или appId, зависит от конфигурации сервера)
 * - room -- имя комнаты (lesson UUID)
 * - exp  -- время жизни токена (2 часа)
 * - context.user -- информация о пользователе
 *
 * Подписывается алгоритмом HS256.
 * Время жизни: 2 часа (покрывает максимальный урок + буфер).
 */
export async function generateJitsiToken(
  roomName: string,
  user: JitsiUser
): Promise<string> {
  validateJitsiConfig()

  if (!roomName || typeof roomName !== 'string') {
    throw new Error('roomName обязателен')
  }

  const secret = new TextEncoder().encode(JITSI_CONFIG.jwtSecret)

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
    .setExpirationTime('2h')
    .sign(secret)

  return token
}
