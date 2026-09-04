// Общая логика генерации AI-отчёта по уроку (OpenAI gpt-4o-mini +
// сохранение в `lesson_summaries`). Раньше жила только в
// `src/app/api/ai/summary/route.ts`; вынесли, чтобы server-action
// `saveTeacherLessonNote` мог триггерить генерацию без self-HTTP-call.

import type { SupabaseClient } from "@supabase/supabase-js"

import { getOpenAI } from "@/lib/openai/client"
import {
  LESSON_SUMMARY_SYSTEM_PROMPT,
  buildUserPrompt,
  parseSummaryResponse,
} from "@/lib/openai/prompts"
import { sendNotification } from "@/lib/notifications/service"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { Json } from "@/types/database"

type AdminClient = SupabaseClient<any, "public", any>

export interface GenerateLessonSummaryInput {
  lessonId: string
  teacherInput: string
  vocabulary?: string[]
  grammarPoints?: string[]
  homework?: string
  /** Уже проинициализированный admin-клиент (гейт вызывающего). */
  admin: AdminClient
}

export type GenerateLessonSummaryResult =
  | { ok: true; summaryId: string; tokensUsed?: number }
  | { ok: false; code: "not_completed" | "already_exists" | "insert_failed"; message: string; summaryId?: string }

/**
 * Генерирует и сохраняет отчёт по уроку. Возвращает id вставленной строки
 * `lesson_summaries` или код ошибки. Уведомление ученику отправляется
 * fire-and-forget внутри функции.
 *
 * ВАЖНО: функция НЕ выполняет auth-check. Вызывающий обязан убедиться,
 * что пользователь имеет право писать отчёт по этому уроку (использовать
 * `requireLessonTeacherOrAdmin` в API-роуте или `requireTeacher` в
 * server-action; из cron/planners можно вызывать напрямую с admin-клиентом).
 */
export async function generateLessonSummary(
  input: GenerateLessonSummaryInput,
): Promise<GenerateLessonSummaryResult> {
  const { lessonId, teacherInput, vocabulary, grammarPoints, homework, admin } = input

  // Проверяем, что урок завершён и summary ещё нет.
  const { data: lessonRow } = await admin
    .from("lessons")
    .select("id, student_id, teacher_id, scheduled_at, status")
    .eq("id", lessonId)
    .maybeSingle<{
      id: string
      student_id: string | null
      teacher_id: string | null
      scheduled_at: string | null
      status: string | null
    }>()

  if (!lessonRow) {
    return { ok: false, code: "not_completed", message: "Урок не найден" }
  }
  if (lessonRow.status !== "completed") {
    return {
      ok: false,
      code: "not_completed",
      message: "Отчёт можно создать только для завершённого урока",
    }
  }

  const { data: existingSummary } = await admin
    .from("lesson_summaries")
    .select("id")
    .eq("lesson_id", lessonId)
    .maybeSingle<{ id: string }>()

  if (existingSummary) {
    return {
      ok: false,
      code: "already_exists",
      message: "Отчёт для этого урока уже существует",
      summaryId: existingSummary.id,
    }
  }

  // Генерация через OpenAI с одним ретраем.
  const userPrompt = buildUserPrompt({ teacherInput, vocabulary, grammarPoints, homework })
  let aiResponse = await callOpenAI(userPrompt)
  if (!aiResponse) {
    console.warn("[lesson-summary] первая попытка не удалась, повторяем")
    aiResponse = await callOpenAI(userPrompt)
  }

  let summaryData: {
    summary_text: string
    vocabulary: Json
    grammar_points: Json
    homework: string | null
    strengths: string | null
    areas_to_improve: string | null
    cefr_level: string | null
  }
  let tokensUsed: number | undefined

  if (aiResponse) {
    tokensUsed = aiResponse.tokens
    const parsed = aiResponse.parsed
    if (parsed) {
      summaryData = {
        summary_text: parsed.summary,
        vocabulary: parsed.vocabulary as unknown as Json,
        grammar_points: parsed.grammar_points as unknown as Json,
        homework: parsed.homework || homework || null,
        strengths: parsed.strengths || null,
        areas_to_improve: parsed.areas_to_improve || null,
        cefr_level: null,
      }
    } else {
      summaryData = buildFallbackSummary(teacherInput, vocabulary, grammarPoints, homework)
    }
  } else {
    summaryData = buildFallbackSummary(teacherInput, vocabulary, grammarPoints, homework)
  }

  const { data: saved, error: saveError } = (await (admin.from("lesson_summaries") as any)
    .insert({
      lesson_id: lessonId,
      student_id: lessonRow.student_id,
      teacher_id: lessonRow.teacher_id,
      ...summaryData,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (saveError || !saved) {
    return {
      ok: false,
      code: "insert_failed",
      message: saveError?.message ?? "Ошибка сохранения отчёта",
    }
  }

  // Уведомляем ученика. fire-and-forget.
  if (lessonRow.student_id && lessonRow.scheduled_at) {
    void notifyStudent({
      admin,
      studentId: lessonRow.student_id,
      teacherId: lessonRow.teacher_id,
      scheduledAt: lessonRow.scheduled_at,
      summaryId: saved.id,
    }).catch((err) => console.error("[lesson-summary] notify failed", err))
  }

  if (tokensUsed) {
    console.info(`[lesson-summary] tokens=${tokensUsed} lesson=${lessonId}`)
  }

  return { ok: true, summaryId: saved.id, tokensUsed }
}

async function callOpenAI(
  userPrompt: string,
): Promise<{ parsed: ReturnType<typeof parseSummaryResponse>; tokens?: number } | null> {
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: LESSON_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
    })
    const content = completion.choices[0]?.message?.content
    if (!content) return null
    return { parsed: parseSummaryResponse(content), tokens: completion.usage?.total_tokens }
  } catch (err) {
    console.error("[lesson-summary] OpenAI error", err)
    return null
  }
}

function buildFallbackSummary(
  teacherInput: string,
  vocabulary?: string[],
  grammarPoints?: string[],
  homework?: string,
) {
  return {
    summary_text: teacherInput,
    vocabulary: (vocabulary || []).map((word) => ({ word, translation: "", example: "" })) as unknown as Json,
    grammar_points: (grammarPoints || []) as unknown as Json,
    homework: homework || null,
    strengths: null,
    areas_to_improve: null,
    cefr_level: null,
  }
}

async function notifyStudent(args: {
  admin: AdminClient
  studentId: string
  teacherId: string | null
  scheduledAt: string
  summaryId: string
}) {
  const scheduledDate = new Date(args.scheduledAt)
  const dateStr = format(scheduledDate, "d MMMM yyyy", { locale: ru })

  let teacherName = "Преподаватель"
  if (args.teacherId) {
    // lessons.teacher_id → teacher_profiles.id → profiles.full_name.
    const { data: tp } = await args.admin
      .from("teacher_profiles")
      .select("user_id")
      .eq("id", args.teacherId)
      .maybeSingle<{ user_id: string | null }>()
    const userId = tp?.user_id
    if (userId) {
      const { data: p } = await args.admin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle<{ full_name: string | null }>()
      if (p?.full_name) teacherName = p.full_name
    }
  }

  await sendNotification(args.studentId, "lesson_summary_ready", {
    teacherName,
    date: dateStr,
    summaryUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/summaries/${args.summaryId}`,
  })
}
