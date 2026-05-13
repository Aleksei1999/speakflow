// @ts-nocheck
// POST /api/lesson/recording/chunk-url
// Выдаёт signed upload URL для одного chunk'а. Через signed URL
// recorder в браузере шлёт chunk напрямую в Supabase Storage —
// без прокачки через наш сервер.
//
// Phase 1.2 update: открыт для ЛЮБОГО участника урока (студент тоже
// пишет свою дорожку). Имя файла зависит от роли:
//   chunk-T-NNNNN.webm — teacher / admin
//   chunk-S-NNNNN.webm — student
// Cron-pipeline следующей фазы будет различать дорожки по префиксу.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"

const BodySchema = z.object({
  lessonId: z.string().uuid(),
  recordingId: z.string().uuid(),
  seq: z.number().int().min(0).max(50_000), // 50k * 30s = ~17 days, с запасом
  mimeType: z.string().min(1).max(60).optional(),
})

const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
])

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
  const { lessonId, recordingId, seq, mimeType } = parsed.data

  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "Unsupported mime type" }, { status: 400 })
  }

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Проверяем что recording существует и относится к этому уроку.
  const { data: rec } = await gate.admin
    .from("lesson_recordings")
    .select("id, storage_prefix, status")
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (!rec) {
    return NextResponse.json({ error: "Recording не найден" }, { status: 404 })
  }
  if (rec.status === "finalized") {
    return NextResponse.json({ error: "Запись уже завершена" }, { status: 409 })
  }

  // Storage path: префикс + chunk-{role}-NNNNN.ext
  // T — teacher/admin, S — student. Одна буква держит filename коротким.
  const roleTag = gate.role === "student" ? "S" : "T"
  const ext = mimeType?.includes("mp4") ? "m4a" : mimeType?.includes("ogg") ? "ogg" : "webm"
  const fileName = `chunk-${roleTag}-${String(seq).padStart(5, "0")}.${ext}`
  const path = `${rec.storage_prefix}${fileName}`

  const { data: signed, error } = await gate.admin.storage
    .from("lesson-recordings")
    .createSignedUploadUrl(path, { upsert: true })

  if (error || !signed) {
    console.error("[recording/chunk-url] signed url failed:", error)
    return NextResponse.json({ error: "Не удалось создать upload URL" }, { status: 500 })
  }

  // Обновляем chunks_count «лениво» — берём максимум по обеим дорожкам.
  // Не атомарно, но для UI достаточно. Cron на финальном merge посчитает
  // точно.
  await gate.admin
    .from("lesson_recordings")
    .update({ chunks_count: seq + 1 })
    .eq("id", recordingId)
    .lt("chunks_count", seq + 1)

  return NextResponse.json({
    path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    role: roleTag,
  })
}
