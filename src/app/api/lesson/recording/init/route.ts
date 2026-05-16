// POST /api/lesson/recording/init
// Препод (или admin) инициирует запись урока. Идемпотентно по статусу:
//   recording  → возвращаем существующую row, ничего не трогаем;
//   failed     → удаляем чанки + row и создаём новую;
//   finalized  → 409, не пересоздаём поверх готовой записи;
//   нет row    → создаём новую.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonTeacherOrAdmin } from "@/lib/api/lesson-auth"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"
import { logAuditEvent } from "@/lib/audit/log"

const BodySchema = z.object({
  lessonId: z.string().uuid(),
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
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }

  // WRITE: запрещаем старт записи на отменённом / завершённом уроке.
  const gate = await requireLessonTeacherOrAdmin(parsed.data.lessonId, { requireActive: true })
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Rate-limit: 20 init/min на пользователя. fail-closed — recording —
  // дорогая операция (создаёт storage prefix + row).
  const limited = await enforceRateLimitStrict(req, {
    name: "lesson:recording:init",
    keyParts: [gate.user.id, getClientIp(req)],
    max: 20,
    windowSeconds: 60,
  })
  if (limited) return limited

  const admin = gate.admin

  // FIXME(types): 'lesson_recordings' table missing in Database type
  type RecordingRow = { id: string; storage_prefix: string; status: 'recording' | 'finalized' | 'failed'; started_at: string }
  // UNIQUE lesson_id → 0 или 1 row.
  const { data: existing } = (await (admin as any)
    .from("lesson_recordings")
    .select("id, storage_prefix, status, started_at")
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()) as { data: RecordingRow | null }

  if (existing) {
    if (existing.status === "recording") {
      // Идемпотентный re-init: возвращаем то же самое.
      return NextResponse.json({
        recordingId: existing.id,
        storagePrefix: existing.storage_prefix,
        bucket: "lesson-recordings",
        status: existing.status,
        startedAt: existing.started_at,
        resumed: true,
      })
    }

    if (existing.status === "finalized") {
      // Запись закрыта — не пересоздаём (transcribe pipeline её уже мог подобрать).
      return NextResponse.json(
        {
          error: "Запись урока уже завершена",
          recordingId: existing.id,
          status: existing.status,
          finalized: true,
        },
        { status: 409 }
      )
    }

    // failed — безопасно чистим и пересоздаём.
    try {
      const { data: files } = await admin.storage
        .from("lesson-recordings")
        .list(existing.storage_prefix.replace(/\/$/, ""), { limit: 1000 })
      const paths = (files ?? []).map((f) => `${existing.storage_prefix}${f.name}`)
      if (paths.length > 0) {
        await admin.storage.from("lesson-recordings").remove(paths)
      }
    } catch (e) {
      console.warn("[recording/init] cleanup failed-row chunks failed:", e)
    }
    // FIXME(types): 'lesson_recordings' table missing in Database type
    await (admin as any)
      .from("lesson_recordings")
      .delete()
      .eq("id", existing.id)
      .eq("status", "failed") // защита от гонки: не трогаем row, если статус сменился между select и delete
  }

  // storage_prefix = lessons/{lesson_id}/{recording_id}/
  const recordingId = crypto.randomUUID()
  const storagePrefix = `lessons/${gate.lesson.id}/${recordingId}/`

  // FIXME(types): 'lesson_recordings' table missing in Database type
  const { data: row, error } = (await (admin as any)
    .from("lesson_recordings")
    .insert({
      id: recordingId,
      lesson_id: gate.lesson.id,
      storage_prefix: storagePrefix,
      status: "recording",
    })
    .select("id, storage_prefix, status, started_at")
    .single()) as { data: RecordingRow | null; error: any }

  if (error || !row) {
    console.error("[recording/init] insert failed:", error)
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 })
  }

  // Audit: начало сессии записи. Каждый chunk НЕ логируем — это спам;
  // только init и finalize. storage_prefix кладём для трассировки в Storage.
  await logAuditEvent(req, {
    category: "data",
    action: "recording_session_initiated",
    target_type: "lesson_recordings",
    target_id: row.id,
    payload: {
      lesson_id: gate.lesson.id,
      storage_prefix: row.storage_prefix,
    },
  })

  return NextResponse.json({
    recordingId: row.id,
    storagePrefix: row.storage_prefix,
    bucket: "lesson-recordings",
    status: row.status,
    startedAt: row.started_at,
  })
}
