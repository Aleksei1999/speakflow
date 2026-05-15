// POST /api/lesson/recording/finalize
// Препод/админ закрывает запись урока. duration_sec / total_bytes /
// chunks_count считаются на сервере, клиентские значения игнорируются.
// Cron-pipeline затем подбирает finalized-row без транскрипта.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireLessonTeacherOrAdmin } from "@/lib/api/lesson-auth"
import { enforceRateLimitStrict, getClientIp } from "@/lib/api/rate-limit"
import { logAuditEvent } from "@/lib/audit/log"
import { invalidateTeacherDashboard, invalidateStudentDashboard } from "@/lib/cache/invalidate"

const BodySchema = z
  .object({
    lessonId: z.string().uuid(),
    recordingId: z.string().uuid(),
    // Принимаем для обратной совместимости со старым клиентом — игнорируем.
    durationSec: z.number().int().optional(),
    totalBytes: z.number().int().optional(),
    chunksCount: z.number().int().optional(),
  })
  .passthrough()

const MAX_DURATION_SEC = 6 * 60 * 60

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

  // Только teacher/admin: студент не может закрыть чужую запись.
  const gate = await requireLessonTeacherOrAdmin(lessonId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  // Rate-limit: 10 finalize/min на пользователя. fail-closed —
  // финализация триггерит cron-pipeline (OpenAI транскрипт = деньги).
  const limited = await enforceRateLimitStrict(req, {
    name: "lesson:recording:finalize",
    keyParts: [gate.user.id, getClientIp(req)],
    max: 10,
    windowSeconds: 60,
  })
  if (limited) return limited

  // FIXME(types): 'lesson_recordings' table missing in Database type
  type RecordingFinalizeRow = {
    id: string
    status: 'recording' | 'finalized' | 'failed'
    storage_prefix: string
    started_at: string | null
    next_seq_t: number | null
    next_seq_s: number | null
    chunks_count: number | null
  }
  const { data: rec } = (await (gate.admin as any)
    .from("lesson_recordings")
    .select("id, status, storage_prefix, started_at, next_seq_t, next_seq_s, chunks_count")
    .eq("id", recordingId)
    .eq("lesson_id", gate.lesson.id)
    .maybeSingle()) as { data: RecordingFinalizeRow | null }

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

  // total_bytes = сумма metadata.size по объектам в storage_prefix через
  // storage list API (лимит 1000 — наших чанков максимум ~360 за 6 часов).
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

  // chunks_count: max(next_seq_t, next_seq_s) — число выданных signed-URL'ов.
  // Recorder мог не доехать с загрузкой — серверный счётчик seq надёжнее.
  const seqT = Number(rec.next_seq_t ?? 0)
  const seqS = Number(rec.next_seq_s ?? 0)
  const seqMax = Math.max(seqT, seqS)
  const chunksCount = Math.max(1, seqMax, Number(rec.chunks_count ?? 0))

  // FIXME(types): 'lesson_recordings' table missing in Database type
  const { error } = await (gate.admin as any)
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
    .neq("status", "finalized") // idempotency для гонки с другим finalize'ом

  if (error) {
    console.error("[recording/finalize] update failed:", error)
    return NextResponse.json({ error: "Не удалось финализировать запись" }, { status: 500 })
  }

  // Audit: финализация сессии. total_bytes тоже кладём — будет видно
  // «насколько большая запись» без обращения к Storage.
  await logAuditEvent(req, {
    category: "data",
    action: "recording_finalized",
    target_type: "lesson_recordings",
    target_id: recordingId,
    payload: {
      lesson_id: gate.lesson.id,
      chunks_count: chunksCount,
      duration_seconds: durationSec,
      total_bytes: totalBytes,
    },
  })

  // Cron 055_complete_finished_lessons флипнет lesson.status →
  // 'completed' в течение минуты, после чего month earnings / week
  // completed-count у учителя и stats/upcoming у студента изменятся.
  // Сбрасываем кешированные dashboard-снапшоты обеих сторон —
  // следующий рендер увидит свежие данные сразу, как cron отработает.
  // Если lesson уже completed — invalidate всё равно безопасен (no-op
  // для тэга без подписчиков).
  try {
    // gate.lesson — это lessons row с teacher_id / student_id (см. lesson-auth).
    const lessonRow: any = (gate as any).lesson
    const teacherProfileId = lessonRow?.teacher_id
    const studentUserId = lessonRow?.student_id
    if (teacherProfileId) {
      // teacher_id -> teacher_profiles.id; нужен auth user_id для тэга.
      const { data: tp } = await gate.admin
        .from("teacher_profiles")
        .select("user_id")
        .eq("id", teacherProfileId)
        .maybeSingle<{ user_id: string }>()
      if (tp?.user_id) invalidateTeacherDashboard(tp.user_id)
    }
    if (studentUserId) {
      invalidateStudentDashboard(studentUserId)
    }
  } catch (e) {
    // invalidation — best-effort; не блокируем ответ recorder'у.
    console.warn("[recording/finalize] dashboard invalidate failed:", e)
  }

  return NextResponse.json({
    ok: true,
    durationSec,
    totalBytes,
    chunksCount,
  })
}
