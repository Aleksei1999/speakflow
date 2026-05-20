// POST /api/livekit/token  body: { lessonId: uuid }
// Эксперимент-only endpoint для теста LiveKit на ветке livekit-experiment.
// Возвращает { token, url, room, isModerator }.
// Параллельно живёт с /api/jitsi/token — не заменяет.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"
import { createLiveKitToken, getLiveKitConfig } from "@/lib/livekit/token"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const BodySchema = z.object({ lessonId: z.string().uuid() })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }

  const gate = await requireLessonParticipant(parsed.data.lessonId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const limited = await enforceRateLimitStrict(req, {
    name: "livekit:token",
    keyParts: [gate.user.id, getClientIp(req)],
    max: 60,
    windowSeconds: 60,
  })
  if (limited) return limited

  const isModerator = gate.role === "teacher" || gate.role === "admin"
  const roomName = `lesson-${gate.lesson.id}`

  // Display name из profiles (admin-client, gate уже прошёл).
  const { data: profile } = await gate.admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", gate.user.id)
    .maybeSingle<{ full_name: string | null; email: string | null }>()
  const participantName = profile?.full_name || profile?.email || gate.user.email || "User"

  let token: string
  try {
    token = await createLiveKitToken({
      roomName,
      participantIdentity: gate.user.id,
      participantName,
      isModerator,
      // Сужаем TTL до фактического окна урока — нет смысла раздавать
      // 4-часовые токены, если урок длится 50 мин.
      scheduledAt: gate.lesson.scheduled_at,
      durationMinutes: gate.lesson.duration_minutes,
    })
  } catch (err) {
    console.error("[livekit/token] sign error:", err)
    return NextResponse.json(
      { error: "LiveKit token signing failed (check env)" },
      { status: 500 }
    )
  }

  const { url } = getLiveKitConfig()
  return NextResponse.json({ token, url, room: roomName, isModerator })
}
