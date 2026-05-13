// @ts-nocheck
// POST /api/lesson/recording/init
// Препод (или admin) инициирует запись урока. Создаёт row в
// lesson_recordings, чистит старые чанки если recording уже был и
// перезапускается, возвращает recording_id + storage_prefix для
// последующего upload'а чанков.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonTeacherOrAdmin } from "@/lib/api/lesson-auth"

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

  const gate = await requireLessonTeacherOrAdmin(parsed.data.lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const admin = gate.admin

  // Если уже есть запись для этого урока — удаляем чанки и саму row,
  // чтобы recorder начал заново чисто.
  const { data: existing } = await admin
    .from("lesson_recordings")
    .select("id, storage_prefix")
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (existing) {
    try {
      // list + remove файлы в префиксе
      const { data: files } = await admin.storage
        .from("lesson-recordings")
        .list(existing.storage_prefix.replace(/\/$/, ""), { limit: 1000 })
      const paths = (files ?? []).map((f) => `${existing.storage_prefix}${f.name}`)
      if (paths.length > 0) {
        await admin.storage.from("lesson-recordings").remove(paths)
      }
    } catch (e) {
      console.warn("[recording/init] cleanup old chunks failed:", e)
    }
    await admin.from("lesson_recordings").delete().eq("id", existing.id)
  }

  // Создаём свежую row. storage_prefix = lessons/{lesson_id}/{recording_id}/
  const recordingId = crypto.randomUUID()
  const storagePrefix = `lessons/${gate.lesson.id}/${recordingId}/`

  const { data: row, error } = await admin
    .from("lesson_recordings")
    .insert({
      id: recordingId,
      lesson_id: gate.lesson.id,
      storage_prefix: storagePrefix,
      status: "recording",
    })
    .select("id, storage_prefix, status, started_at")
    .single()

  if (error || !row) {
    console.error("[recording/init] insert failed:", error)
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 500 })
  }

  return NextResponse.json({
    recordingId: row.id,
    storagePrefix: row.storage_prefix,
    bucket: "lesson-recordings",
    status: row.status,
    startedAt: row.started_at,
  })
}
