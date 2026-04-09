/**
 * Конфигурация Jitsi Meet.
 *
 * JITSI_DOMAIN       -- домен Jitsi-сервера (например, meet.speakflow.ru)
 * JITSI_JWT_APP_ID   -- идентификатор приложения для JWT (по умолчанию "speakflow")
 * JITSI_JWT_SECRET   -- секретный ключ для подписи JWT (HS256)
 */
export const JITSI_CONFIG = {
  domain: process.env.JITSI_DOMAIN ?? '',
  appId: process.env.JITSI_JWT_APP_ID ?? 'speakflow',
  jwtSecret: process.env.JITSI_JWT_SECRET ?? '',
} as const

export function validateJitsiConfig(): void {
  if (!JITSI_CONFIG.domain) {
    throw new Error('JITSI_DOMAIN не задан в переменных окружения')
  }
  if (!JITSI_CONFIG.jwtSecret) {
    throw new Error('JITSI_JWT_SECRET не задан в переменных окружения')
  }
}
