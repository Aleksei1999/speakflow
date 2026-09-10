// POST /api/livekit/token  body: { lessonId: uuid }
// Эксперимент-only endpoint для теста LiveKit на ветке livekit-experiment.
// Возвращает { token, url, room, isModerator }.
// Параллельно живёт с /api/jitsi/token — не заменяет.

import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { z } from "zod"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"
import { computeLessonAccess } from "@/lib/lesson-access"
import { LESSON_JOIN_WINDOW } from "@/lib/constants"
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

  // Статус и временное окно — как у /api/jitsi/token: отменённый/завершённый
  // урок не пускаем, до окна — 425, после — 410.
  const lessonStatus = gate.lesson.status ?? ""
  if (lessonStatus === "cancelled") {
    return NextResponse.json({ error: "Урок отменён" }, { status: 409 })
  }
  if (lessonStatus !== "booked" && lessonStatus !== "in_progress") {
    return NextResponse.json({ error: "Урок недоступен для подключения" }, { status: 409 })
  }
  const access = computeLessonAccess({
    scheduledAt: gate.lesson.scheduled_at ?? new Date(0).toISOString(),
    durationMinutes: gate.lesson.duration_minutes ?? 50,
    status: lessonStatus,
  })
  if (access.status === "waiting") {
    const minutesUntilJoin = Math.ceil((access.openAtMs - access.nowMs) / 60000)
    return NextResponse.json(
      { error: `Комната откроется за ${LESSON_JOIN_WINDOW} мин до старта (через ~${minutesUntilJoin} мин)` },
      { status: 425 }
    )
  }
  if (access.status === "expired") {
    return NextResponse.json({ error: "Время урока истекло" }, { status: 410 })
  }
  // Ученик подключается только при достаточном балансе (урок списывается при завершении).
  if (gate.role === "student") {
    const { data: lessonRow } = await gate.admin.from("lessons").select("price").eq("id", gate.lesson.id).maybeSingle()
    const price = Number((lessonRow as { price: number | null } | null)?.price ?? 0)
    if (price > 0) {
      const { data: paid } = await gate.admin.from("payments").select("id").eq("lesson_id", gate.lesson.id).eq("status", "succeeded").limit(1).maybeSingle()
      if (!paid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bal } = await (gate.admin as any).from("student_balances").select("balance_kopecks").eq("user_id", gate.user.id).maybeSingle()
        const balance = Number((bal as { balance_kopecks: number | null } | null)?.balance_kopecks ?? 0)
        if (balance < price) {
          const rub = (n: number) => Math.round(n / 100).toLocaleString("ru-RU")
          return NextResponse.json(
            { error: `Недостаточно средств: урок стоит ${rub(price)} ₽, на балансе ${rub(balance)} ₽. Пополните баланс в кабинете.` },
            { status: 402 }
          )
        }
      }
    }
  }
  // Первое подключение переводит урок в in_progress — иначе cron mark_missed_lessons
  // пометит проведённый урок как no_show, а complete_finished_lessons никогда не сработает.
  if (lessonStatus === "booked") {
    await gate.admin.from("lessons").update({ status: "in_progress" }).eq("id", gate.lesson.id).eq("status", "booked")
  }

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
    Sentry.captureException(err, {
      tags: { endpoint: "livekit/token" },
      extra: { lessonId: parsed.data.lessonId, userId: gate.user.id },
    })
    return NextResponse.json(
      { error: "LiveKit token signing failed (check env)" },
      { status: 500 }
    )
  }

  const { url } = getLiveKitConfig()
  return NextResponse.json({ token, url, room: roomName, isModerator })
}
