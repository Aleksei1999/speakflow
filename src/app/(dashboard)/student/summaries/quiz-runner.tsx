"use client"

// Прохождение AI-квиза прямо в /student/summaries.
// Один attempt на квиз — после сабмита показываем результат и больше
// не даём перепроходить. Тут же подсвечиваем сколько XP заработал.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface QuizQuestion {
  q: string
  choices: string[]
  correct_index: number
  explanation?: string | null
}

interface PreviousAttempt {
  score: number
  total: number
  xpAwarded: number
  answers: { question_index: number; chosen_index: number; correct: boolean }[]
}

interface Props {
  quizId: string
  questions: QuizQuestion[]
  /** null если ещё не сдавал */
  previous: PreviousAttempt | null
}

type Result = {
  score: number
  total: number
  perfect: boolean
  xpAwarded: number
}

export function QuizRunner({ quizId, questions, previous }: Props) {
  const router = useRouter()
  const [chosen, setChosen] = useState<number[]>(() =>
    questions.map((_, i) =>
      previous ? previous.answers[i]?.chosen_index ?? -1 : -1
    )
  )
  const [submitted, setSubmitted] = useState<boolean>(!!previous)
  const [result, setResult] = useState<Result | null>(
    previous
      ? {
          score: previous.score,
          total: previous.total,
          perfect: previous.score === previous.total,
          xpAwarded: previous.xpAwarded,
        }
      : null
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allAnswered = chosen.every((c) => c >= 0)

  async function submit() {
    if (!allAnswered) {
      setError("Ответь на все вопросы")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch("/api/lesson/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: chosen }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok && r.status !== 409) {
        setError(j?.error ?? "Не удалось отправить")
        setSubmitting(false)
        return
      }
      const score = j.score ?? j.total ?? 0
      const total = j.total ?? questions.length
      setResult({
        score,
        total,
        perfect: score === total,
        xpAwarded: j.xpAwarded ?? 0,
      })
      setSubmitted(true)
      // После сабмита перезагружаем страницу — server-side подтянет
      // questions с correct_index/explanation (раньше скрытые, security MED).
      router.refresh()
    } catch (e: any) {
      setError(e?.message ?? "Ошибка сети")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-[#CC3A3A]" />
        Тест по уроку ({questions.length} вопросов)
      </div>

      {result && (
        <div
          className={cn(
            "rounded-lg p-3 text-sm font-medium",
            result.perfect
              ? "bg-green-500/10 text-green-700"
              : result.score >= Math.ceil(result.total / 2)
                ? "bg-amber-500/10 text-amber-700"
                : "bg-red-500/10 text-red-700"
          )}
        >
          Результат: {result.score} / {result.total}
          {result.xpAwarded > 0 && (
            <span className="ml-2">+{result.xpAwarded} XP</span>
          )}
          {result.perfect && " · идеально!"}
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {questions.map((q, qi) => {
          const userChoice = chosen[qi]
          return (
            <li key={qi} className="flex flex-col gap-2">
              <div className="text-sm font-medium">
                {qi + 1}. {q.q}
              </div>
              <div className="flex flex-col gap-1.5">
                {q.choices.map((c, ci) => {
                  const isPicked = userChoice === ci
                  const isCorrect = ci === q.correct_index
                  const showResult = submitted
                  return (
                    <button
                      key={ci}
                      type="button"
                      disabled={submitted}
                      onClick={() => {
                        if (submitted) return
                        setChosen((prev) => {
                          const next = [...prev]
                          next[qi] = ci
                          return next
                        })
                      }}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                        !showResult &&
                          isPicked &&
                          "border-[#CC3A3A] bg-[#CC3A3A]/10",
                        !showResult &&
                          !isPicked &&
                          "hover:border-[#CC3A3A]/40",
                        showResult &&
                          isCorrect &&
                          "border-green-500 bg-green-500/10",
                        showResult &&
                          !isCorrect &&
                          isPicked &&
                          "border-red-500 bg-red-500/10",
                        submitted && "cursor-default"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                          !showResult &&
                            isPicked &&
                            "border-[#CC3A3A] bg-[#CC3A3A] text-white",
                          showResult &&
                            isCorrect &&
                            "border-green-500 bg-green-500 text-white",
                          showResult &&
                            !isCorrect &&
                            isPicked &&
                            "border-red-500 bg-red-500 text-white"
                        )}
                      >
                        {String.fromCharCode(65 + ci)}
                      </span>
                      <span className="flex-1">{c}</span>
                      {showResult && isCorrect && (
                        <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                      )}
                      {showResult && !isCorrect && isPicked && (
                        <XCircle className="size-4 shrink-0 text-red-600" />
                      )}
                    </button>
                  )
                })}
              </div>
              {submitted && q.explanation && (
                <p className="text-xs text-muted-foreground">
                  {q.explanation}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {!submitted && (
        <div className="flex items-center justify-between gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          <Button
            onClick={submit}
            disabled={submitting || !allAnswered}
            className="ml-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Отправка...
              </>
            ) : (
              "Отправить ответы"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
