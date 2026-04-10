// @ts-nocheck
import { redirect } from "next/navigation"
import { format, differenceInHours, differenceInMinutes } from "date-fns"
import { ru } from "date-fns/locale"
import {
  Calendar,
  Flame,
  Trophy,
  BookOpen,
  Clock,
  GraduationCap,
  Wallet,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/stats-card"
import { UpcomingLessons } from "@/components/dashboard/upcoming-lessons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date().toISOString()

  const [lessonsResult, progressResult, summariesResult, profileResult, skillsResult, homeworkResult] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, jitsi_room_name, price, teacher_id")
        .eq("student_id", user.id)
        .eq("status", "booked")
        .gte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(5),
      supabase.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("lesson_summaries")
        .select("id, summary_text, vocabulary, created_at, lesson_id")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("skill_progress").select("*").eq("user_id", user.id),
      supabase
        .from("homework")
        .select("id, title, due_date, status, teacher_id")
        .eq("student_id", user.id)
        .order("due_date", { ascending: true })
        .limit(5),
    ])

  const lessons = (lessonsResult.data ?? []).map((l: any) => ({
    id: l.id,
    scheduled_at: l.scheduled_at,
    duration_minutes: l.duration_minutes,
    status: l.status,
    jitsi_room_name: l.jitsi_room_name,
    price: l.price ?? 0,
    teacher: null,
  }))

  const progress = progressResult.data
  const summaries = summariesResult.data ?? []
  const profile = profileResult.data
  const skills = skillsResult?.data ?? []
  const homework = homeworkResult?.data ?? []

  const nextLesson = lessons[0]
  const nextLessonCountdown = nextLesson ? formatCountdown(nextLesson.scheduled_at) : "---"

  // Build skill map
  const skillMap: Record<string, number> = {}
  for (const s of skills) {
    skillMap[s.skill] = s.percentage
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Ожидает", color: "bg-yellow-100 text-yellow-800" },
    in_progress: { label: "В работе", color: "bg-blue-100 text-blue-800" },
    submitted: { label: "Сдано", color: "bg-green-100 text-green-800" },
    reviewed: { label: "Проверено", color: "bg-green-100 text-green-800" },
    overdue: { label: "Просрочено", color: "bg-red-100 text-red-800" },
  }

  // Mini calendar data
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7 // Monday=0
  const lessonDays = new Set(
    lessons.map((l) => new Date(l.scheduled_at).getDate())
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Добро пожаловать, {profile?.full_name?.split(" ")[0] ?? "Ученик"}!
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
              ? format(new Date(nextLesson.scheduled_at), "d MMM, HH:mm", { locale: ru })
              : "Нет запланированных"
          }
          icon={<Calendar className="size-5" />}
        />
        <StatsCard
          title="Уроков завершено"
          value={progress?.lessons_completed ?? 0}
          description={`+${progress?.current_streak ?? 0} на этой неделе`}
          icon={<BookOpen className="size-5" />}
        />
        <StatsCard
          title="Текущий уровень"
          value={progress?.english_level ?? "---"}
          description={`${progress?.total_xp ?? 0} XP`}
          icon={<Trophy className="size-5" />}
        />
        <StatsCard
          title="Streak"
          value={`${progress?.current_streak ?? 0} дней`}
          description={`Лучший: ${progress?.longest_streak ?? 0} дней`}
          icon={<Flame className="size-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming lessons — 2 columns */}
        <div className="lg:col-span-2">
          <UpcomingLessons lessons={lessons} userRole="student" />
        </div>

        {/* Right column: Progress + Calendar */}
        <div className="flex flex-col gap-6">
          {/* Skill Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4 text-[#CC3A3A]" />
                Прогресс до {progress?.english_level === "B2" ? "C1" : "B2"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {[
                { key: "grammar", label: "Грамматика" },
                { key: "vocabulary", label: "Лексика" },
                { key: "speaking", label: "Говорение" },
                { key: "listening", label: "Аудирование" },
              ].map((skill) => {
                const pct = skillMap[skill.key] ?? 0
                return (
                  <div key={skill.key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{skill.label}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#CC3A3A] to-[#DFED8C] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Mini Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {format(today, "LLLL yyyy", { locale: ru })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <span key={d} className="py-1 font-medium text-muted-foreground">{d}</span>
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <span key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === today.getDate()
                  const hasLesson = lessonDays.has(day)
                  return (
                    <span
                      key={day}
                      className={`relative flex size-8 items-center justify-center rounded-lg text-xs ${
                        isToday
                          ? "bg-[#CC3A3A] font-bold text-white"
                          : hasLesson
                            ? "bg-[#DFED8C]/50 font-medium"
                            : "hover:bg-muted"
                      }`}
                    >
                      {day}
                      {hasLesson && !isToday && (
                        <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#CC3A3A]" />
                      )}
                    </span>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Homework Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-[#CC3A3A]" />
            Домашние задания
          </CardTitle>
        </CardHeader>
        <CardContent>
          {homework.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Домашних заданий пока нет
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="pb-2 pr-4">Задание</th>
                    <th className="pb-2 pr-4">Срок сдачи</th>
                    <th className="pb-2 pr-4">Статус</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {homework.map((hw: any) => {
                    const st = statusLabels[hw.status] ?? statusLabels.pending
                    return (
                      <tr key={hw.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{hw.title}</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {format(new Date(hw.due_date), "d MMM", { locale: ru })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <Button variant="outline" size="sm">
                            Открыть
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Summaries */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4 text-[#CC3A3A]" />
            AI-саммари
          </CardTitle>
          <Link href="/student/summaries">
            <Button variant="link" size="sm">Все</Button>
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {summaries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              AI-саммари появятся после первого урока
            </p>
          ) : (
            summaries.map((summary: any) => {
              const vocabList = Array.isArray(summary.vocabulary) ? summary.vocabulary : []
              const vocabPreview = vocabList.slice(0, 3)
              return (
                <Link
                  key={summary.id}
                  href="/student/summaries"
                  className="group flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(summary.created_at), "d MMM yyyy", { locale: ru })}
                    </span>
                    {vocabList.length > 0 && (
                      <Badge variant="outline" className="text-[#CC3A3A] border-[#CC3A3A]/30">
                        {vocabList.length} слов
                      </Badge>
                    )}
                  </div>
                  {vocabPreview.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {vocabPreview.map((word: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {typeof word === "string" ? word : word?.word ?? word?.term ?? ""}
                        </Badge>
                      ))}
                      {vocabList.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{vocabList.length - 3}</Badge>
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
  )
}
