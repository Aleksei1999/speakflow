// POST /api/livekit/group-token  body: { groupId: uuid }
// Возвращает { token, url, room, isModerator } для группового звонка.
// Auth: юзер должен быть участником группы (owner-teacher, member-student,
// или admin). Проверка через is_group_participant() (миграция 20260831).

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createLiveKitToken, getLiveKitConfig } from "@/lib/livekit/token"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const BodySchema = z.object({ groupId: z.string().uuid() })

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing groupId" }, { status: 400 })
  }
  const { groupId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient() as any

  // Auth: user is participant?  Проверяем owner / member / admin через
  // SQL-функцию (SECURITY DEFINER).
  const { data: check } = await admin.rpc("is_group_participant", {
    gid: groupId,
    uid: user.id,
  })
  if (!check) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const limited = await enforceRateLimitStrict(req, {
    name: "livekit:group-token",
    keyParts: [user.id, getClientIp(req)],
    max: 60,
    windowSeconds: 60,
  })
  if (limited) return limited

  // Moderator = teacher-owner OR admin.
  const { data: prof } = await admin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle()
  const role = prof?.role ?? "student"
  let isOwner = false
  if (role === "teacher") {
    const { data: tp } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    const teacherPk = tp?.id ?? null
    if (teacherPk) {
      const { data: g } = await admin
        .from("teacher_groups")
        .select("id")
        .eq("id", groupId)
        .eq("teacher_id", teacherPk)
        .maybeSingle()
      isOwner = !!g
    }
  }
  const isModerator = isOwner || role === "admin"

  const roomName = `group-${groupId}`
  const participantName = prof?.full_name || prof?.email || user.email || "User"

  let token: string
  try {
    token = await createLiveKitToken({
      roomName,
      participantIdentity: user.id,
      participantName,
      isModerator,
      // 4ч TTL — стандартный cap. Групповой звонок обычно короче.
    })
  } catch (err) {
    console.error("[livekit/group-token] sign error:", err)
    Sentry.captureException(err, {
      tags: { endpoint: "livekit/group-token" },
      extra: { groupId, userId: user.id },
    })
    return NextResponse.json(
      { error: "LiveKit token signing failed (check env)" },
      { status: 500 }
    )
  }

  const { url } = getLiveKitConfig()
  return NextResponse.json({ token, url, room: roomName, isModerator })
}
