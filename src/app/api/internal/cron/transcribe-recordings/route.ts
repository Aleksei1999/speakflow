// @ts-nocheck
// POST /api/internal/cron/transcribe-recordings
// Запускается pg_cron'ом каждые 5 минут (миграция 058).
// Берёт ОДНУ свежую finalized запись без транскрипта, скачивает
// чанки teacher + student, прогоняет каждый через OpenAI
// gpt-4o-transcribe, склеивает в диалог и сохраняет в
// lesson_transcripts.
//
// Один-в-тик нарочно: 50-мин урок = до ~3 мин на gpt-4o-transcribe.
// На Vercel maxDuration=300с — комфортный запас. Если уроков много,
// они обработаются за несколько тиков (5 мин × N).

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOpenAI } from "@/lib/openai/client"
import {
  listRecordingChunks,
  downloadRecordingForRole,
} from "@/lib/ai/recordings"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

const MODEL = "gpt-4o-transcribe"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Берём одну запись без транскрипта.
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

  // Отфильтровать те, для которых уже есть транскрипт.
  const ids = candidates.map((c) => c.id)
  const { data: existing } = await admin
    .from("lesson_transcripts")
    .select("recording_id")
    .in("recording_id", ids)
  const done = new Set((existing ?? []).map((e: any) => e.recording_id))
  const target = candidates.find((c) => !done.has(c.id))
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
  const segments: { role: "teacher" | "student"; text: string }[] = []

  for (const role of ["T", "S"] as const) {
    const dl = await downloadRecordingForRole(admin, chunks, role)
    if (!dl) continue

    try {
      // OpenAI SDK ждёт File-like с .name. Blob недостаточно — добавим
      // полифилл через File() конструктор (Node 20+, Edge — оба есть).
      const file = new File(
        [dl.blob],
        `lesson-${target.lesson_id}-${role}.${dl.ext}`,
        { type: dl.blob.type }
      )
      // gpt-4o-transcribe v1 поддерживает language hint и prompt.
      // Не задаём language: уроки русско-английские, auto-detect работает лучше.
      const resp = await openai.audio.transcriptions.create({
        file,
        model: MODEL,
        response_format: "text",
        prompt:
          role === "T"
            ? "Преподаватель ведёт онлайн-урок английского. Это речь преподавателя."
            : "Студент изучает английский. Это речь ученика, возможны ошибки и акцент.",
      })
      const text = typeof resp === "string" ? resp : (resp as any)?.text ?? ""
      if (text.trim().length > 0) {
        segments.push({
          role: role === "T" ? "teacher" : "student",
          text: text.trim(),
        })
      }
    } catch (e: any) {
      console.warn(`[cron/transcribe] OpenAI ${role} failed:`, e?.message ?? e)
    }
  }

  if (segments.length === 0) {
    await admin.from("lesson_transcripts").insert({
      lesson_id: target.lesson_id,
      recording_id: target.id,
      full_text: "",
      status: "failed",
      error_message: "all transcriptions failed or empty",
    })
    return NextResponse.json({ ok: false, reason: "transcribe_empty" })
  }

  // Простой merge: один блок на роль. На MVP этого достаточно — GPT
  // отдельно сможет разнести по микро-репликам по контексту.
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
