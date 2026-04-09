// @ts-nocheck
import { redirect } from "next/navigation"
import { format, differenceInMinutes, differenceInHours } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar, Flame, Trophy, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/stats-card"
import { UpcomingLessons } from "@/components/dashboard/upcoming-lessons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function formatCountdown(scheduledAt: string): string {
  const now = new Date()
  const date = new Date(scheduledAt)
  const hoursLeft = differenceInHours(date, now)
  const minutesLeft = differenceInMinutes(date, now) % 60

  if (hoursLeft < 0) return "Прошёл"
  if (hoursLeft === 0 && minutesLeft <= 0) return "Сейчас"
  if (hoursLeft < 1) return `${minutesLeft} мин`
  if (hoursLeft < 24) return `${hoursLeft} ч ${minutesLeft} мин`
  const days = Math.floor(hoursLeft / 24)
  return `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default async function StudentDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const now = new Date().toISOString()

  const [lessonsResult, progressResult, summariesResult, profileResult] =
    await Promise.all([
      supabase
        .from("lessons")
        .select(
          "id, scheduled_at, duration_minutes, status, jitsi_room_name, price, teacher_id, profiles!lessons_teacher_id_fkey(full_name, avatar_url)"
        )
        .eq("student_id", user.id)
        .eq("status", "booked")
        .gte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(5),
      supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("lesson_summaries")
        .select(
          "id, summary_text, vocabulary, cefr_level, created_at, lesson_id, lessons!lesson_summaries_lesson_id_fkey(scheduled_at, profiles!lessons_teacher_id_fkey(full_name, avatar_url))"
        )
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),
    ])

  const lessons = (lessonsResult.data ?? []).map((l: any) => ({
    id: l.id,
    scheduled_at: l.scheduled_at,
    duration_minutes: l.duration_minutes,
    status: l.status,
    jitsi_room_name: l.jitsi_room_name,
    price: l.price ?? 0,
    teacher: l.profiles
      ? { full_name: l.profiles.full_name, avatar_url: l.profiles.avatar_url }
      : null,
  }))

  const progress = progressResult.data
  const summaries = summariesResult.data ?? []
  const profile = profileResult.data

  const nextLesson = lessons[0]
  const nextLessonCountdown = nextLesson
    ? formatCountdown(nextLesson.scheduled_at)
    : "---"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Привет, {profile?.full_name?.split(" ")[0] ?? "Ученик"}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Ваш прогресс и предстоящие уроки
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Следующий урок"
          value={nextLessonCountdown}
          description={
            nextLesson
              ? format(new Date(nextLesson.scheduled_at), "d MMM, HH:mm", {
                  locale: ru,
                })
              : "Нет запланированных"
          }
          icon={<Calendar className="size-5" />}
        />
        <StatsCard
          title="Уроков завершено"
          value={progress?.lessons_completed ?? 0}
          icon={<BookOpen className="size-5" />}
        />
        <StatsCard
          title="Текущий streak"
          value={`${progress?.current_streak ?? 0} дней`}
          description={`Лучший: ${progress?.longest_streak ?? 0} дней`}
          icon={<Flame className="size-5" />}
        />
        <StatsCard
          title="Уровень английского"
          value={progress?.english_level ?? "---"}
          description={`${progress?.total_xp ?? 0} XP, уровень ${progress?.current_level ?? 1}`}
          icon={<Trophy className="size-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming lessons */}
        <div className="lg:col-span-2">
          <UpcomingLessons lessons={lessons} userRole="student" />
        </div>

        {/* Recent AI Summaries */}
        <div>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4 text-[#722F37]" />
                AI-саммари
              </CardTitle>
              <Link href="/student/summaries">
                <Button variant="link" size="sm">
                  Все
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {summaries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  AI-саммари появятся после первого урока
                </p>
              ) : (
                summaries.map((summary: any) => {
                  const lesson = summary.lessons
                  const teacher = lesson?.profiles
                  const vocabList = Array.isArray(summary.vocabulary)
                    ? summary.vocabulary
                    : []
                  const vocabPreview = vocabList.slice(0, 3)

                  return (
                    <Link
                      key={summary.id}
                      href="/student/summaries"
                      className="group flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar size="sm">
                            {teacher?.avatar_url ? (
                              <AvatarImage
                                src={teacher.avatar_url}
                                alt={teacher.full_name}
                              />
                            ) : null}
                            <AvatarFallback>
                              {teacher
                                ? getInitials(teacher.full_name)
                                : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {teacher?.full_name ?? "Преподаватель"}
                          </span>
                        </div>
                        {summary.cefr_level && (
                          <Badge
                            variant="outline"
                            className="text-[#722F37] border-[#722F37]/30"
                          >
                            {summary.cefr_level}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {format(new Date(summary.created_at), "d MMM yyyy", {
                          locale: ru,
                        })}
                      </p>

                      {vocabPreview.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {vocabPreview.map((word: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {typeof word === "string" ? word : word?.word ?? word?.term ?? ""}
                            </Badge>
                          ))}
                          {vocabList.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{vocabList.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
