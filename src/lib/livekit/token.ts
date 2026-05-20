// Server-side LiveKit access-token issuer.
// Production: LiveKit для всех новых уроков. Jitsi оставлен как fallback
// через NEXT_PUBLIC_VIDEO_PROVIDER=jitsi.

import { AccessToken } from "livekit-server-sdk"
import { LESSON_POST_WINDOW } from "@/lib/constants"

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ""
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ""
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? ""

export function getLiveKitConfig() {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error(
      "LiveKit env missing: LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL"
    )
  }
  return { apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET, url: LIVEKIT_URL }
}

// Защита от выдачи токена с многочасовым окном:
// если переданы scheduledAt + durationMinutes, режем TTL до
// конца урока + LESSON_POST_WINDOW + небольшой буфер. Cap на 4 часа
// остаётся как абсолютная верхняя граница.
const ABSOLUTE_TTL_CAP_SECONDS = 60 * 60 * 4
const TTL_BUFFER_SECONDS = 5 * 60

export interface LiveKitTokenArgs {
  roomName: string
  participantIdentity: string
  participantName: string
  isModerator: boolean
  ttlSeconds?: number
  /** ISO-строка scheduled_at урока — сужает TTL до окна доступа. */
  scheduledAt?: string | null
  /** Длительность урока в минутах. */
  durationMinutes?: number | null
}

export async function createLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
  isModerator,
  ttlSeconds,
  scheduledAt,
  durationMinutes,
}: LiveKitTokenArgs): Promise<string> {
  // 1. Если caller явно указал ttlSeconds — берём его (с cap).
  // 2. Иначе если знаем расписание — считаем close-window from now.
  // 3. Fallback: ABSOLUTE_TTL_CAP_SECONDS (legacy 4ч).
  let effectiveTtl: number
  if (typeof ttlSeconds === "number" && ttlSeconds > 0) {
    effectiveTtl = Math.min(ttlSeconds, ABSOLUTE_TTL_CAP_SECONDS)
  } else if (scheduledAt && typeof durationMinutes === "number" && durationMinutes > 0) {
    const scheduledMs = Date.parse(scheduledAt)
    if (Number.isFinite(scheduledMs)) {
      const closeAtMs =
        scheduledMs +
        durationMinutes * 60_000 +
        LESSON_POST_WINDOW * 60_000
      const secondsUntilClose = Math.ceil((closeAtMs - Date.now()) / 1000) + TTL_BUFFER_SECONDS
      effectiveTtl = Math.min(
        ABSOLUTE_TTL_CAP_SECONDS,
        Math.max(60, secondsUntilClose) // минимум 1 мин: гарантируем connect
      )
    } else {
      effectiveTtl = ABSOLUTE_TTL_CAP_SECONDS
    }
  } else {
    effectiveTtl = ABSOLUTE_TTL_CAP_SECONDS
  }

  const cfg = getLiveKitConfig()
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: effectiveTtl,
  })
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isModerator,
    roomCreate: isModerator,
  })
  return await at.toJwt()
}
