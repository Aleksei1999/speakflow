// @ts-nocheck
// GET /api/lesson/recording/active?lessonId=<uuid>
// Студенту нужен endpoint чтобы после входа в комнату узнать
// recordingId, который teacher создал через /init. Возвращает row
// со status='recording' либо null. Любой участник урока.

import { NextRequest, NextResponse } from "next/server"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"

export async function GET(req: NextRequest) {
  const lessonId = new URL(req.url).searchParams.get("lessonId")

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: rec } = await gate.admin
    .from("lesson_recordings")
    .select("id, storage_prefix, status, started_at")
    .eq("lesson_id", gate.lesson.id)
    .eq("status", "recording")
    .maybeSingle()

  if (!rec) {
    return NextResponse.json({ active: false })
  }

  return NextResponse.json({
    active: true,
    recordingId: rec.id,
    storagePrefix: rec.storage_prefix,
    bucket: "lesson-recordings",
    startedAt: rec.started_at,
  })
}
