// @ts-nocheck
// POST /api/lesson/recording/finalize
// Препод (или admin) сообщает: запись закончена. Помечаем row
// status='finalized', проставляем итоги. Cron-pipeline на следующей
// фазе подбирает finalized без transcript_url → отдаёт в Whisper.
//
// SEC(MED) billing/integrity fix: длительность, размер и chunks_count
// БОЛЬШЕ НЕ ПРИНИМАЮТСЯ ОТ КЛИЕНТА. Клиент мог занизить duration_sec
// (биллинговый риск, если payouts/limits когда-нибудь будут считать
// эти минуты) или завысить chunks_count, чтобы сломать UI и cron.
//
// Теперь:
//   duration_sec  = round((finalized_at - started_at) / 1000) на сервере.
//   total_bytes   = sum((metadata->>'size')::bigint) по storage.objects
//                   с префиксом recording.storage_prefix (service-role).
//   chunks_count  = из колонки в lesson_recordings, где её уже атомарно
//                   двигает RPC lesson_recordings_next_seq при выдаче
//                   каждого signed-URL'а (мигр 063).
//
// ROLLING DEPLOY: схема всё ещё принимает durationSec/totalBytes/
// chunksCount как ОПЦИОНАЛЬНЫЕ — старый клиент (use-lesson-recorder
// на текущем prod-build) шлёт их через sendBeacon на beforeunload. Мы
// эти поля просто игнорируем; источник истины — сервер. Когда recorder
// hook будет обновлён (вне allow-list этой работы), их можно будет
// убрать из BodySchema совсем.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonTeacherOrAdmin } from "@/lib/api/lesson-auth"

const BodySchema = z
  .object({
    lessonId: z.string().uuid(),
    recordingId: z.string().uuid(),
    // Оставляем поля в схеме для обратной совместимости с прошлым
    // клиентом — ИГНОРИРУЕМ их полностью в логике ниже. Не валидируем
    // строго, чтобы старый клиент не отбивался на пустых/больших
    // значениях.
    durationSec: z.number().int().optional(),
    totalBytes: z.number().int().optional(),
    chunksCount: z.number().int().optional(),
  })
  .passthrough()

const MAX_DURATION_SEC = 6 * 60 * 60 // 6 часов — реалистичный потолок одного урока

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
  const { lessonId, recordingId } = parsed.data

  // FIX CRIT-5: finalize teacher/admin-only. Студент не может закрыть
  // чужую запись (см. историю в src/components/lesson/use-lesson-recorder.ts).
  const gate = await requireLessonTeacherOrAdmin(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: rec } = await gate.admin
    .from("lesson_recordings")
    .select("id, status, storage_prefix, started_at, next_seq_t, next_seq_s, chunks_count")
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()

  if (!rec) {
    return NextResponse.json({ error: "Recording не найден" }, { status: 404 })
  }
  if (rec.status === "finalized") {
    return NextResponse.json({ ok: true, alreadyFinalized: true })
  }

  const finalizedAtIso = new Date().toISOString()
  const startedAtMs = rec.started_at ? new Date(rec.started_at).getTime() : Date.now()
  let durationSec = Math.round((Date.now() - startedAtMs) / 1000)
  if (!Number.isFinite(durationSec) || durationSec < 1) durationSec = 1
  if (durationSec > MAX_DURATION_SEC) durationSec = MAX_DURATION_SEC

  // total_bytes = сумма metadata.size по объектам в storage_prefix.
  // Используем official storage list API (через service-role client):
  // он возвращает FileObject[] с metadata.size — это надёжнее, чем
  // ходить в storage.objects через PostgREST (схема storage может
  // быть не exposed). Лимит 1000 — наших чанков максимум ~360 (6ч/мин).
  let totalBytes = 0
  try {
    const prefixDir = rec.storage_prefix.replace(/\/$/, "")
    const { data: files, error: listErr } = await gate.admin.storage
      .from("lesson-recordings")
      .list(prefixDir, { limit: 1000 })
    if (listErr) {
      console.warn("[recording/finalize] storage list err:", listErr)
    } else if (Array.isArray(files)) {
      for (const f of files) {
        const size = (f as any)?.metadata?.size
        const n = typeof size === "string" ? parseInt(size, 10) : Number(size)
        if (Number.isFinite(n) && n > 0) totalBytes += n
      }
    }
  } catch (e) {
    console.warn("[recording/finalize] storage size aggregation failed:", e)
  }

  // chunks_count: max(next_seq_t, next_seq_s) — это число выданных
  // signed-URL'ов. Используем как верхнюю границу. Реальное число
  // загруженных файлов тоже есть из storage list выше, но recorder
  // мог недоехать с загрузкой — оставляем серверный счётчик seq.
  const seqT = Number(rec.next_seq_t ?? 0)
  const seqS = Number(rec.next_seq_s ?? 0)
  const seqMax = Math.max(seqT, seqS)
  const chunksCount = Math.max(1, seqMax, Number(rec.chunks_count ?? 0))

  const { error } = await gate.admin
    .from("lesson_recordings")
    .update({
      status: "finalized",
      duration_sec: durationSec,
      total_bytes: totalBytes,
      chunks_count: chunksCount,
      finalized_at: finalizedAtIso,
    })
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .neq("status", "finalized") // idempotency на гонку с конкурентным finalize'ом

  if (error) {
    console.error("[recording/finalize] update failed:", error)
    return NextResponse.json({ error: "Не удалось финализировать запись" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    durationSec,
    totalBytes,
    chunksCount,
  })
}
