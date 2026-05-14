// @ts-nocheck
// POST /api/lesson/recording/init
// Препод (или admin) инициирует запись урока. ИДЕМПОТЕНТНО:
//
//  - status='recording'  → возвращаем existing recordingId + storagePrefix,
//                          НИЧЕГО не удаляем (защита от случайного второго
//                          клика, который бы wipe'ал все накопленные чанки).
//  - status='failed'     → удаляем чанки + row, создаём новую запись.
//  - status='finalized'  → 409, чтобы UI не пересоздавал поверх готовой
//                          записи (можно отрефакторить под reuse, но не
//                          молчком).
//  - row отсутствует     → создаём свежую row + storage_prefix.
//
// SEC(MED) fix: раньше второй клик teacher (или гонка двух вкладок) сразу
// удалял все чанки активной записи. Теперь destructive cleanup только для
// явно failed-записей.

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

  // 1. Существующая запись для этого урока (UNIQUE lesson_id → 0 или 1 row).
  const { data: existing } = await admin
    .from("lesson_recordings")
    .select("id, storage_prefix, status, started_at")
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === "recording") {
      // Идемпотентный re-init: возвращаем то же самое, ничего не трогаем.
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
      // Запись уже закрыта — не даём её пересоздавать (transcribe pipeline
      // её уже мог подобрать). UI должен показать «запись урока готова».
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

    // status === 'failed' — можно безопасно зачистить и пересоздать.
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
    await admin
      .from("lesson_recordings")
      .delete()
      .eq("id", existing.id)
      .eq("status", "failed") // double-belt: не трогаем row, если статус сменился между select'ом и delete'ом
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
