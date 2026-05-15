// GET /api/lesson/recording/active?lessonId=<uuid>
// Возвращает активную recording-row урока (status='recording') либо null.
// Доступно любому участнику урока — студент так узнаёт recordingId,
// созданный учителем через /init.

import { NextRequest, NextResponse } from "next/server"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"

export async function GET(req: NextRequest) {
  const lessonId = new URL(req.url).searchParams.get("lessonId")

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // FIXME(types): 'lesson_recordings' table missing in Database type
  const { data: rec } = (await (gate.admin as any)
    .from("lesson_recordings")
    .select("id, storage_prefix, status, started_at")
    .eq("lesson_id", gate.lesson.id)
    .eq("status", "recording")
    .maybeSingle()) as { data: { id: string; storage_prefix: string; status: string; started_at: string } | null }

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
