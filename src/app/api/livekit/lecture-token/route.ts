// POST /api/livekit/lecture-token  body: { lectureId: uuid }
// Возвращает { token, url, room, isModerator } для комнаты лекции.
// Auth: любой аутентифицированный пользователь → published-лекция.
// Moderator = admin. Room = `lecture-<id>`.

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLiveKitToken, getLiveKitConfig } from "@/lib/livekit/token"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const LECTURE_JOIN_WINDOW_MIN = 15
const LECTURE_POST_WINDOW_MIN = 30
const BodySchema = z.object({ lectureId: z.string().uuid() })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing lectureId" }, { status: 400 })
  }
  const { lectureId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient() as any
  const { data: lecture } = await admin
    .from("lectures")
    .select("id, scheduled_at, duration_minutes, is_published")
    .eq("id", lectureId)
    .maybeSingle()
  if (!lecture || lecture.is_published === false) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  // Окно доступа: за 15 минут до начала и до 30 минут после конца.
  const startMs = Date.parse(lecture.scheduled_at)
  const endMs = startMs + (lecture.duration_minutes ?? 60) * 60_000
  const nowMs = Date.now()
  if (nowMs < startMs - LECTURE_JOIN_WINDOW_MIN * 60_000) {
    const minutes = Math.ceil((startMs - LECTURE_JOIN_WINDOW_MIN * 60_000 - nowMs) / 60000)
    return NextResponse.json({ error: `Комната откроется за ${LECTURE_JOIN_WINDOW_MIN} мин до начала (через ~${minutes} мин)` }, { status: 425 })
  }
  if (nowMs > endMs + LECTURE_POST_WINDOW_MIN * 60_000) {
    return NextResponse.json({ error: "Лекция уже закончилась" }, { status: 410 })
  }

  const limited = await enforceRateLimitStrict(req, {
    name: "livekit:lecture-token",
    keyParts: [user.id, getClientIp(req)],
    max: 60,
    windowSeconds: 60,
  })
  if (limited) return limited

  const { data: prof } = await admin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle()
  const isModerator = prof?.role === "admin"
  // Ученик заходит только по записи; учитель/админ — ведущие.
  if (prof?.role !== "admin" && prof?.role !== "teacher") {
    const { data: reg } = await admin
      .from("lecture_registrations")
      .select("id")
      .eq("lecture_id", lecture.id)
      .eq("student_id", user.id)
      .maybeSingle()
    if (!reg) return NextResponse.json({ error: "Вы не записаны на эту лекцию" }, { status: 403 })
  }

  const roomName = `lecture-${lecture.id}`
  const participantName = prof?.full_name || prof?.email || user.email || "User"

  let token: string
  try {
    token = await createLiveKitToken({
      roomName,
      participantIdentity: user.id,
      participantName,
      isModerator,
      scheduledAt: lecture.scheduled_at,
      durationMinutes: lecture.duration_minutes ?? 60,
    })
  } catch (err) {
    console.error("[livekit/lecture-token] sign error:", err)
    Sentry.captureException(err, {
      tags: { endpoint: "livekit/lecture-token" },
      extra: { lectureId, userId: user.id },
    })
    return NextResponse.json(
      { error: "LiveKit token signing failed (check env)" },
      { status: 500 }
    )
  }

  const { url } = getLiveKitConfig()
  return NextResponse.json({ token, url, room: roomName, isModerator })
}
