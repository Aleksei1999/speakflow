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

/** Минимальная длина HS256-секрета (RFC 7518 §3.2: >= 256 bit). */
const JITSI_JWT_SECRET_MIN_BYTES = 32

export function validateJitsiConfig(): void {
  if (!JITSI_CONFIG.domain) {
    throw new Error('JITSI_DOMAIN не задан в переменных окружения')
  }
  if (!JITSI_CONFIG.jwtSecret) {
    throw new Error('JITSI_JWT_SECRET не задан в переменных окружения')
  }
  // HS256 brute-force защита: короткие секреты подбираются за разумное время.
  // Длина в байтах через Buffer (мультибайтные символы тоже учитываются корректно).
  const secretBytes = Buffer.byteLength(JITSI_CONFIG.jwtSecret, 'utf8')
  if (secretBytes < JITSI_JWT_SECRET_MIN_BYTES) {
    throw new Error(
      `JITSI_JWT_SECRET слишком короткий (${secretBytes} байт). Минимум ${JITSI_JWT_SECRET_MIN_BYTES} байт. ` +
        'Сгенерируй: `openssl rand -hex 32`'
    )
  }
}
