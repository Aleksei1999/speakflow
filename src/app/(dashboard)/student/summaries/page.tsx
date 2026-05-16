import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ru, enUS } from "date-fns/locale"
import { getLocale, getTranslations } from "next-intl/server"
import { BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { SummaryExpandable } from "./summary-expandable"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default async function StudentSummariesPage() {
  const supabase = await createClient()
  const t = await getTranslations("dashboard.student.summaries")
  const locale = await getLocale()
  const dfLocale = locale === "en" ? enUS : ru

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: summaries } = await supabase
    .from("lesson_summaries")
    .select(
      "id, summary_text, vocabulary, grammar_points, homework, strengths, areas_to_improve, cefr_level, source, created_at, lesson_id, lessons!lesson_summaries_lesson_id_fkey(scheduled_at, profiles!lessons_teacher_id_fkey(full_name, avatar_url))"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })

  const items = (summaries ?? []) as any[]

  // Подтягиваем квизы для всех саммари сразу. RLS на lesson_quizzes
  // отфильтрует чужие, на attempts — тоже.
  const summaryIds = items.map((s) => s.id)
  const [{ data: quizzes }, { data: attempts }] = await Promise.all([
    summaryIds.length
      ? supabase
          .from("lesson_quizzes")
          .select("id, summary_id, questions, question_count")
          .in("summary_id", summaryIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("lesson_quiz_attempts")
      .select("quiz_id, score, total, xp_awarded, answers")
      .eq("student_id", user.id),
  ])

  const quizBySummary = new Map<string, any>()
  for (const q of (quizzes ?? []) as any[]) quizBySummary.set(q.summary_id, q)
  const attemptByQuiz = new Map<string, any>()
  for (const a of (attempts ?? []) as any[]) attemptByQuiz.set(a.quiz_id, a)

  // Security MED: correct_index + explanation выдаём клиенту ТОЛЬКО
  // после того как студент сабмитил квиз (тогда уже не имеет смысла
  // скрывать). До сабмита — стрипаем. Без этого студент мог открыть
  // DevTools и увидеть все правильные ответы в jsonb.
  for (const q of quizBySummary.values()) {
    const attempted = attemptByQuiz.has(q.id)
    if (!attempted && Array.isArray(q.questions)) {
      q.questions = q.questions.map((it: any) => {
        const { correct_index: _ci, explanation: _ex, ...safe } = it ?? {}
        void _ci; void _ex
        return safe
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("headingPrefix")}<span className="gl">{t("headingWord")}</span></h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {t("emptyTitle")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((summary) => {
            const teacher = summary.lessons?.profiles
            const teacherName = teacher?.full_name ?? t("fallbackTeacher")
            const vocabList = Array.isArray(summary.vocabulary)
              ? summary.vocabulary
              : []
            const grammarList = Array.isArray(summary.grammar_points)
              ? summary.grammar_points
              : []

            const quizRow = quizBySummary.get(summary.id)
            const attempt = quizRow ? attemptByQuiz.get(quizRow.id) : null
            const quizProp = quizRow
              ? {
                  id: quizRow.id as string,
                  questions: (quizRow.questions ?? []) as any[],
                  previous: attempt
                    ? {
                        score: attempt.score,
                        total: attempt.total,
                        xpAwarded: attempt.xp_awarded,
                        answers: attempt.answers ?? [],
                      }
                    : null,
                }
              : null

            return (
              <SummaryExpandable
                key={summary.id}
                id={summary.id}
                header={
                  <div className="flex w-full items-center gap-3">
                    <Avatar>
                      {teacher?.avatar_url ? (
                        <AvatarImage
                          src={teacher.avatar_url}
                          alt={teacherName}
                        />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(teacherName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <p className="text-sm font-medium">{teacherName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(summary.created_at), "d MMMM yyyy", {
                          locale: dfLocale,
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {vocabList.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {t("vocabCount", { count: vocabList.length })}
                        </Badge>
                      )}
                      {summary.cefr_level && (
                        <Badge
                          variant="outline"
                          className="text-[#CC3A3A] border-[#CC3A3A]/30"
                        >
                          {summary.cefr_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                }
                summaryText={summary.summary_text}
                vocabulary={vocabList}
                grammarPoints={grammarList}
                homework={summary.homework}
                strengths={summary.strengths}
                areasToImprove={summary.areas_to_improve}
                quiz={quizProp}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
