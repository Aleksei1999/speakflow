// @ts-nocheck
// POST /api/internal/cron/summarize-transcripts
// Pg_cron каждые 5 минут. Берёт свежий ok-транскрипт без recording-саммари,
// прогоняет через GPT-4o (json_schema → структурированный конспект + квиз),
// пишет в lesson_summaries / lesson_quizzes и уведомляет студента.

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOpenAI } from "@/lib/openai/client"
import {
  TRANSCRIPT_SUMMARY_SYSTEM_PROMPT,
  buildTranscriptUserPrompt,
  SUMMARY_RESPONSE_JSON_SCHEMA,
  summaryResponseSchema,
} from "@/lib/openai/transcript-prompts"
import { sendNotification } from "@/lib/notifications/service"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

const MODEL = "gpt-4o-2024-08-06" // json_schema strict + русский/английский

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: transcripts, error: tErr } = await admin
    .from("lesson_transcripts")
    .select("id, lesson_id, recording_id, full_text, duration_sec, created_at")
    .eq("status", "ok")
    .order("created_at", { ascending: true })
    .limit(20)
  if (tErr) {
    console.error("[cron/summarize] list transcripts failed:", tErr)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }
  if (!transcripts || transcripts.length === 0) {
    return NextResponse.json({ ok: true, picked: null })
  }

  // Отсекаем уроки, для которых recording-саммари уже создан.
  const lessonIds = transcripts.map((t) => t.lesson_id)
  const { data: existing } = await admin
    .from("lesson_summaries")
    .select("lesson_id, source")
    .in("lesson_id", lessonIds)
    .eq("source", "recording")
  const done = new Set((existing ?? []).map((e: any) => e.lesson_id))
  const target = transcripts.find((t) => !done.has(t.lesson_id))
  if (!target) return NextResponse.json({ ok: true, picked: null })

  // student_id / teacher_id для саммари берём из lessons.
  const { data: lesson, error: lErr } = await admin
    .from("lessons")
    .select("id, student_id, teacher_id, duration_minutes")
    .eq("id", target.lesson_id)
    .single()
  if (lErr || !lesson) {
    console.error("[cron/summarize] lesson lookup failed:", lErr)
    return NextResponse.json({ error: "lesson missing" }, { status: 500 })
  }
  if (!lesson.student_id || !lesson.teacher_id) {
    return NextResponse.json({ ok: false, reason: "lesson_missing_participants" })
  }

  const openai = getOpenAI()
  const durationMin = Math.max(1, Math.round((target.duration_sec ?? lesson.duration_minutes * 60) / 60))

  let parsed
  let tokensUsed: number | null = null
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: SUMMARY_RESPONSE_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: TRANSCRIPT_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildTranscriptUserPrompt(target.full_text, durationMin),
        },
      ],
    })
    tokensUsed = completion.usage?.total_tokens ?? null
    const raw = completion.choices[0]?.message?.content ?? "{}"
    const json = JSON.parse(raw)
    parsed = summaryResponseSchema.parse(json)
  } catch (e: any) {
    console.error("[cron/summarize] OpenAI failed:", e?.message ?? e)
    return NextResponse.json({ ok: false, reason: "openai_failed" }, { status: 502 })
  }

  const { data: summary, error: sErr } = await admin
    .from("lesson_summaries")
    .insert({
      lesson_id: target.lesson_id,
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
      teacher_input: null,
      source: "recording",
      recording_id: target.recording_id,
      transcript_id: target.id,
      summary_text: parsed.summary,
      // Колонка vocabulary — TEXT[]. Сжимаем объект в строку.
      vocabulary: parsed.vocabulary.map(
        (v) => `${v.word} — ${v.translation}: ${v.example}`
      ),
      grammar_points: parsed.grammar_points,
      homework: parsed.homework || null,
      strengths: parsed.strengths,
      areas_to_improve: parsed.areas_to_improve,
      ai_model: MODEL,
      tokens_used: tokensUsed,
    })
    .select("id")
    .single()

  if (sErr || !summary) {
    console.error("[cron/summarize] insert summary failed:", sErr)
    return NextResponse.json({ error: "summary insert failed" }, { status: 500 })
  }

  const { error: qErr } = await admin.from("lesson_quizzes").insert({
    summary_id: summary.id,
    lesson_id: target.lesson_id,
    questions: parsed.quiz,
    question_count: parsed.quiz.length,
  })
  if (qErr) {
    console.error("[cron/summarize] insert quiz failed:", qErr)
    // Саммари остаётся, квиз регенерируем вручную при необходимости.
  }

  // Уведомление студента — ошибки игнорируем, саммари важнее.
  try {
    await sendNotification(lesson.student_id, "lesson_summary_ready", {
      lessonId: target.lesson_id,
      summaryId: summary.id,
    })
  } catch (e) {
    console.warn("[cron/summarize] notify failed:", e)
  }

  console.log(`[cron/summarize] OK lesson=${target.lesson_id} summary=${summary.id} tokens=${tokensUsed}`)
  return NextResponse.json({
    ok: true,
    lessonId: target.lesson_id,
    summaryId: summary.id,
    tokensUsed,
  })
}
