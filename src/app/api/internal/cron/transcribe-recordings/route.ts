// @ts-nocheck
// POST /api/internal/cron/transcribe-recordings
// Pg_cron каждые 5 минут. Берёт одну finalized-запись без транскрипта,
// прогоняет чанки teacher+student через gpt-4o-transcribe и склеивает
// в диалог в lesson_transcripts. По одной за тик: 50-мин урок ~3 мин
// на модели, очередь обрабатывается за несколько тиков.

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOpenAI } from "@/lib/openai/client"
import {
  listRecordingChunks,
  downloadChunk,
} from "@/lib/ai/recordings"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

const MODEL = "gpt-4o-transcribe"
const MAX_ATTEMPTS = 5

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: candidates, error: candErr } = await admin
    .from("lesson_recordings")
    .select("id, lesson_id, storage_prefix, duration_sec, finalized_at")
    .eq("status", "finalized")
    .order("finalized_at", { ascending: true })
    .limit(20)

  if (candErr) {
    console.error("[cron/transcribe] cand list failed:", candErr)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, picked: null })
  }

  // Исключаем recording'и с ok-транскриптом или превысившие MAX_ATTEMPTS.
  const ids = candidates.map((c) => c.id)
  const { data: existing } = await admin
    .from("lesson_transcripts")
    .select("recording_id, status")
    .in("recording_id", ids)
  const failedCounts = new Map<string, number>()
  const okSet = new Set<string>()
  for (const row of existing ?? []) {
    if ((row as any).status === "ok") okSet.add((row as any).recording_id)
    else if ((row as any).status === "failed") {
      const k = (row as any).recording_id
      failedCounts.set(k, (failedCounts.get(k) ?? 0) + 1)
    }
  }
  const target = candidates.find((c) => !okSet.has(c.id) && (failedCounts.get(c.id) ?? 0) < MAX_ATTEMPTS)
  if (!target) {
    return NextResponse.json({ ok: true, picked: null })
  }

  console.log(`[cron/transcribe] picked recording=${target.id} lesson=${target.lesson_id}`)

  let chunks
  try {
    chunks = await listRecordingChunks(admin, target.storage_prefix)
  } catch (e: any) {
    console.error("[cron/transcribe] list chunks failed:", e?.message ?? e)
    await admin.from("lesson_transcripts").insert({
      lesson_id: target.lesson_id,
      recording_id: target.id,
      full_text: "",
      status: "failed",
      error_message: `list chunks: ${e?.message ?? e}`,
    })
    return NextResponse.json({ ok: false, reason: "list_failed" }, { status: 500 })
  }

  if (chunks.length === 0) {
    console.warn(`[cron/transcribe] recording=${target.id} has 0 chunks — marking failed`)
    await admin.from("lesson_transcripts").insert({
      lesson_id: target.lesson_id,
      recording_id: target.id,
      full_text: "",
      status: "failed",
      error_message: "no chunks in storage",
    })
    return NextResponse.json({ ok: false, reason: "no_chunks" })
  }

  const openai = getOpenAI()
  // Каждый chunk транскрибируется отдельно: побайтная склейка webm
  // даёт невалидный EBML, и OpenAI возвращает пусто.
  const segments: { role: "teacher" | "student"; text: string }[] = []
  const textsByRole: Record<"T" | "S", string[]> = { T: [], S: [] }
  let chunksTranscribed = 0
  let chunksFailed = 0
  // Первые 3 ошибки сохраним в error_message — иначе теряются в логах.
  const errorSamples: string[] = []

  for (const chunk of chunks) {
    const dl = await downloadChunk(admin, chunk)
    if (!dl) {
      chunksFailed++
      if (errorSamples.length < 3) errorSamples.push(`${chunk.name}: download failed`)
      continue
    }
    try {
      const file = new File(
        [dl.blob],
        `lesson-${target.lesson_id}-${chunk.role}-${chunk.seq}.${dl.ext}`,
        { type: dl.blob.type }
      )
      const resp = await openai.audio.transcriptions.create({
        file,
        model: MODEL,
        response_format: "text",
        prompt:
          chunk.role === "T"
            ? "Преподаватель ведёт онлайн-урок английского. Это речь преподавателя."
            : "Студент изучает английский. Это речь ученика, возможны ошибки и акцент.",
      })
      const text = (typeof resp === "string" ? resp : (resp as any)?.text ?? "").trim()
      if (text.length > 0) {
        textsByRole[chunk.role].push(text)
        chunksTranscribed++
      } else {
        chunksFailed++
        if (errorSamples.length < 3) errorSamples.push(`${chunk.name}: empty response (${dl.bytes}B, ${dl.blob.type})`)
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      console.warn(`[cron/transcribe] chunk ${chunk.name} failed:`, msg)
      chunksFailed++
      if (errorSamples.length < 3) errorSamples.push(`${chunk.name}: ${msg.slice(0, 200)}`)
    }
  }

  for (const role of ["T", "S"] as const) {
    const joined = textsByRole[role].join(" ").trim()
    if (joined.length > 0) {
      segments.push({ role: role === "T" ? "teacher" : "student", text: joined })
    }
  }
  console.log(`[cron/transcribe] chunks ok=${chunksTranscribed} fail=${chunksFailed} of ${chunks.length}`)

  if (segments.length === 0) {
    const { count: prevAttempts } = await admin
      .from("lesson_transcripts")
      .select("id", { count: "exact", head: true })
      .eq("recording_id", target.id)
      .eq("status", "failed")
    const attemptsSoFar = (prevAttempts ?? 0) + 1
    const reason = `[attempt ${attemptsSoFar}] chunks=${chunks.length} ok=${chunksTranscribed} fail=${chunksFailed}; sample: ${errorSamples.join(" | ") || "n/a"}`
    await admin.from("lesson_transcripts").insert({
      lesson_id: target.lesson_id,
      recording_id: target.id,
      full_text: "",
      status: "failed",
      error_message: reason.slice(0, 1000),
      attempts: attemptsSoFar,
    })
    return NextResponse.json({ ok: false, reason: "transcribe_empty", attempts: attemptsSoFar })
  }

  // Простой merge: один блок на роль. GPT саммаризатор разнесёт по репликам.
  const fullText = segments
    .map((s) => `${s.role === "teacher" ? "Teacher" : "Student"}: ${s.text}`)
    .join("\n\n")

  const { error: insErr } = await admin.from("lesson_transcripts").insert({
    lesson_id: target.lesson_id,
    recording_id: target.id,
    full_text: fullText,
    segments,
    model: MODEL,
    duration_sec: target.duration_sec,
    status: "ok",
  })

  if (insErr) {
    console.error("[cron/transcribe] insert transcript failed:", insErr)
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 })
  }

  console.log(`[cron/transcribe] OK lesson=${target.lesson_id} chars=${fullText.length}`)
  return NextResponse.json({ ok: true, lessonId: target.lesson_id, chars: fullText.length })
}
