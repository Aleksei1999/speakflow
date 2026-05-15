// @ts-nocheck
// POST /api/lesson/quiz/submit
// Студент сабмитит ответы на квиз → считаем правильные → пишем
// lesson_quiz_attempts → начисляем XP через award_xp.
//
// Идемпотентно: повторный submit с тем же quiz_id вернёт 409 со
// старым результатом — UNIQUE(quiz_id, student_id) в БД.

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enforceRateLimitStrict } from "@/lib/api/rate-limit"
import { invalidateStudentDashboard } from "@/lib/cache/invalidate"

const BodySchema = z.object({
  quizId: z.string().uuid(),
  // массив выбранных индексов в порядке вопросов. -1 = не отвечено.
  answers: z.array(z.number().int().min(-1).max(5)).min(1).max(20),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
  const { quizId, answers } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 })

  const admin = createAdminClient()

  // Загружаем квиз + урок, чтобы убедиться что вызывающий — student урока.
  const { data: quiz } = await admin
    .from("lesson_quizzes")
    .select("id, lesson_id, questions, question_count, summary_id, lessons:lesson_id(student_id)")
    .eq("id", quizId)
    .maybeSingle()
  if (!quiz) return NextResponse.json({ error: "Квиз не найден" }, { status: 404 })
  if ((quiz as any).lessons?.student_id !== user.id) {
    return NextResponse.json({ error: "Это не ваш урок" }, { status: 403 })
  }

  const limited = await enforceRateLimitStrict(req, {
    name: "lesson:quiz",
    keyParts: [user.id, quiz.lesson_id],
    max: 10,
    windowSeconds: 60,
  })
  if (limited) return limited

  if (answers.length !== quiz.question_count) {
    return NextResponse.json({ error: "Неверное число ответов" }, { status: 400 })
  }

  // Существующая попытка?
  const { data: existing } = await admin
    .from("lesson_quiz_attempts")
    .select("id, score, total, xp_awarded, answers")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({
      ok: false,
      alreadySubmitted: true,
      score: existing.score,
      total: existing.total,
      xpAwarded: existing.xp_awarded,
      previousAnswers: existing.answers,
    }, { status: 409 })
  }

  // Подсчёт.
  const questions = (quiz.questions ?? []) as any[]
  const detail: { question_index: number; chosen_index: number; correct: boolean }[] = []
  let score = 0
  for (let i = 0; i < questions.length; i++) {
    const ci = answers[i] ?? -1
    const correct = ci === Number(questions[i]?.correct_index)
    if (correct) score++
    detail.push({ question_index: i, chosen_index: ci, correct })
  }
  const total = questions.length
  const perfect = score === total
  const xpAmount = score * 5 + (perfect ? 20 : 0)

  // Сначала пишем attempt (источник истины), потом начисляем XP.
  const { data: attempt, error: aErr } = await admin
    .from("lesson_quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: user.id,
      score,
      total,
      answers: detail,
      xp_awarded: xpAmount,
    })
    .select("id")
    .single()
  if (aErr || !attempt) {
    console.error("[quiz/submit] insert attempt failed:", aErr)
    return NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 })
  }

  if (xpAmount > 0) {
    const { data: xpRes, error: xpErr } = await admin.rpc("award_xp", {
      p_user_id: user.id,
      p_source: "lesson_quiz",
      p_source_id: attempt.id,
      p_amount: xpAmount,
      p_description: `Тест по уроку: ${score}/${total}${perfect ? " (perfect)" : ""}`,
      p_metadata: { quiz_id: quizId, lesson_id: quiz.lesson_id },
    })
    if (xpErr) {
      console.warn("[quiz/submit] award_xp failed:", xpErr)
    } else {
      console.log("[quiz/submit] award_xp:", xpRes)
    }
  }

  // Dashboard snapshot включает progress + recent_xp_events.
  invalidateStudentDashboard(user.id)

  return NextResponse.json({
    ok: true,
    score,
    total,
    perfect,
    xpAwarded: xpAmount,
  })
}
