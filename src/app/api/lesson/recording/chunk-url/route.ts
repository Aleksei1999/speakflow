// @ts-nocheck
// POST /api/lesson/recording/chunk-url
// Выдаёт signed upload URL для очередного chunk'а. seq назначает
// СЕРВЕР атомарным UPDATE по next_seq_{t,s} на lesson_recordings —
// клиент seq больше не передаёт. upsert:false → повторный PUT
// на тот же путь не сможет перезаписать существующий chunk.
//
// Чанки разводятся по дорожкам по роли (CRIT-5 + HIGH-9):
//   chunk-T-NNNNN.webm — teacher / admin
//   chunk-S-NNNNN.webm — student

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonParticipant } from "@/lib/api/lesson-auth"

const BodySchema = z.object({
  lessonId: z.string().uuid(),
  recordingId: z.string().uuid(),
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

const MAX_SEQ = 50_000 // защита от runaway

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
  const { lessonId, recordingId, mimeType } = parsed.data

  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "Unsupported mime type" }, { status: 400 })
  }

  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: rec } = await gate.admin
    .from("lesson_recordings")
    .select("id, storage_prefix, status")
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (!rec) return NextResponse.json({ error: "Recording не найден" }, { status: 404 })
  if (rec.status === "finalized") {
    return NextResponse.json({ error: "Запись уже завершена" }, { status: 409 })
  }

  const roleTag = gate.role === "student" ? "S" : "T"

  // Атомарный SQL UPDATE с RETURNING через SECURITY DEFINER RPC —
  // защищает от race condition между конкурентными запросами клиента.
  const { data: assigned, error: rpcErr } = await gate.admin.rpc(
    "lesson_recordings_next_seq",
    { p_recording_id: recordingId, p_role: roleTag }
  )
  if (rpcErr || assigned == null) {
    console.error("[recording/chunk-url] next_seq RPC failed:", rpcErr)
    return NextResponse.json({ error: "Не удалось выделить seq" }, { status: 500 })
  }
  const seq = Number(assigned)
  if (!Number.isFinite(seq) || seq < 0 || seq > MAX_SEQ) {
    return NextResponse.json({ error: "Seq overflow" }, { status: 409 })
  }

  const ext = mimeType?.includes("mp4") ? "m4a" : mimeType?.includes("ogg") ? "ogg" : "webm"
  const fileName = `chunk-${roleTag}-${String(seq).padStart(5, "0")}.${ext}`
  const path = `${rec.storage_prefix}${fileName}`

  // upsert:false — write-once. Повторный PUT на тот же signed URL
  // упадёт; если клиент потерял ответ и retry'ит /chunk-url, он
  // получит НОВЫЙ seq и новый path, ничего чужого не затрёт.
  const { data: signed, error } = await gate.admin.storage
    .from("lesson-recordings")
    .createSignedUploadUrl(path, { upsert: false })

  if (error || !signed) {
    console.error("[recording/chunk-url] signed url failed:", error)
    return NextResponse.json({ error: "Не удалось создать upload URL" }, { status: 500 })
  }

  // chunks_count = MAX(next_seq_t, next_seq_s) для UI индикатора.
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
    seq,
  })
}
