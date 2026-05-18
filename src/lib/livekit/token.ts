// Server-side LiveKit access-token issuer.
// Эксперимент: branch `livekit-experiment`. Сравниваем с нашим Jitsi.
// Production live на Jitsi, не трогаем.

import { AccessToken } from "livekit-server-sdk"

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

export interface LiveKitTokenArgs {
  roomName: string
  participantIdentity: string
  participantName: string
  isModerator: boolean
  ttlSeconds?: number
}

export async function createLiveKitToken({
  roomName,
  participantIdentity,
  participantName,
  isModerator,
  ttlSeconds = 60 * 60 * 4,
}: LiveKitTokenArgs): Promise<string> {
  const cfg = getLiveKitConfig()
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: ttlSeconds,
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
