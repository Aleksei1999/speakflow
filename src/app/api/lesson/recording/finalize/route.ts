// @ts-nocheck
// POST /api/lesson/recording/finalize
// Recorder в браузере сообщает: запись закончена. Помечаем row
// status='finalized', сохраняем итоговую длительность и размер.
// Cron-pipeline на следующей фазе подберёт всё что finalized и без
// transcript_url → отдаст в Whisper.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonTeacherOrAdmin } from "@/lib/api/lesson-auth"

const BodySchema = z.object({
  lessonId: z.string().uuid(),
  recordingId: z.string().uuid(),
  durationSec: z.number().int().min(1).max(6 * 60 * 60), // максимум 6 часов на одну запись
  totalBytes: z.number().int().min(0).max(2_000_000_000), // 2GB защитный потолок
  chunksCount: z.number().int().min(1).max(50_000),
})

export async function POST(req: NextRequest) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  const { lessonId, recordingId, durationSec, totalBytes, chunksCount } = parsed.data

  const gate = await requireLessonTeacherOrAdmin(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: rec } = await gate.admin
    .from("lesson_recordings")
    .select("id, status")
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (!rec) {
    return NextResponse.json({ error: "Recording не найден" }, { status: 404 })
  }
  if (rec.status === "finalized") {
    // Idempotent: уже finalized — просто отдаём ok.
    return NextResponse.json({ ok: true, alreadyFinalized: true })
  }

  const { error } = await gate.admin
    .from("lesson_recordings")
    .update({
      status: "finalized",
      duration_sec: durationSec,
      total_bytes: totalBytes,
      chunks_count: chunksCount,
      finalized_at: new Date().toISOString(),
    })
    .eq("id", recordingId)

  if (error) {
    console.error("[recording/finalize] update failed:", error)
    return NextResponse.json({ error: "Не удалось финализировать запись" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
