import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: summaries } = await supabase
    .from("lesson_summaries")
    .select(
      "id, summary_text, vocabulary, grammar_points, homework, strengths, areas_to_improve, cefr_level, created_at, lesson_id, lessons!lesson_summaries_lesson_id_fkey(scheduled_at, profiles!lessons_teacher_id_fkey(full_name, avatar_url))"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })

  const items = (summaries ?? []) as any[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI-<span className="gl">саммари</span></h1>
        <p className="text-sm text-muted-foreground">
          Автоматические резюме ваших уроков
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              AI-саммари появятся после первого урока
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((summary) => {
            const teacher = summary.lessons?.profiles
            const teacherName = teacher?.full_name ?? "Преподаватель"
            const vocabList = Array.isArray(summary.vocabulary)
              ? summary.vocabulary
              : []
            const grammarList = Array.isArray(summary.grammar_points)
              ? summary.grammar_points
              : []

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
                          locale: ru,
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {vocabList.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {vocabList.length} слов
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
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
