// @ts-nocheck
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date()

  const [profileResult, lessonsResult, progressResult, completedResult, skillsResult, homeworkResult, summariesResult] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id")
        .eq("student_id", user.id)
        .eq("status", "booked")
        .gte("scheduled_at", now.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5),
      supabase.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .eq("status", "completed"),
      supabase.from("skill_progress").select("*").eq("user_id", user.id),
      supabase
        .from("homework")
        .select("id, title, due_date, status, teacher_id")
        .eq("student_id", user.id)
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("lesson_summaries")
        .select("id, vocabulary, created_at")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ])

  const profile = profileResult.data
  const lessons = lessonsResult.data ?? []
  const progress = progressResult.data
  const completedCount = completedResult.count ?? 0
  const skills = skillsResult?.data ?? []
  const homework = homeworkResult?.data ?? []
  const summaries = summariesResult?.data ?? []
  const firstName = profile?.full_name?.split(" ")[0] ?? "Ученик"

  // Skill map
  const skillMap: Record<string, number> = {}
  for (const s of skills) skillMap[s.skill] = s.percentage

  // Hours calculation (50 min per lesson)
  const totalHours = Math.round((completedCount * 50) / 60)

  // Calendar
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lessonDays = new Set(lessons.map((l) => new Date(l.scheduled_at).getDate()))

  // Homework status config
  const hwStatus: Record<string, { label: string; cls: string }> = {
    pending: { label: "Ожидает", cls: "bg-amber-100 text-amber-800" },
    in_progress: { label: "В работе", cls: "bg-blue-100 text-blue-800" },
    submitted: { label: "Сдано", cls: "bg-green-100 text-green-700" },
    reviewed: { label: "Проверено", cls: "bg-green-100 text-green-700" },
    overdue: { label: "Просрочено", cls: "bg-red-100 text-red-700" },
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Добро пожаловать, {firstName}!
        </h1>
      </div>

      {/* === Stats Grid === */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Пройдено уроков</span>
            <span className="text-3xl font-bold text-[#CC3A3A]">{completedCount}</span>
            <span className="text-xs text-green-600">+{progress?.current_streak ?? 0} на этой неделе</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Часов обучения</span>
            <span className="text-3xl font-bold text-[#CC3A3A]">{totalHours}</span>
            <span className="text-xs text-green-600">+{Math.round((progress?.current_streak ?? 0) * 50 / 60 * 10) / 10} на этой неделе</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Текущий уровень</span>
            <span className="text-3xl font-bold text-[#CC3A3A]">{progress?.english_level ?? "—"}</span>
            <span className="text-xs text-muted-foreground">{progress?.english_level ? "Intermediate" : "Пройдите тест"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Баланс</span>
            <span className="text-3xl font-bold text-[#CC3A3A]">{progress?.total_xp ?? 0} XP</span>
            <span className="text-xs text-muted-foreground">Уровень {progress?.current_level ?? 1}</span>
          </CardContent>
        </Card>
      </div>

      {/* === Main Grid: Lessons + (Progress + Calendar) === */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Upcoming Lessons */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Ближайшие уроки</CardTitle>
            <Link href="/student/schedule">
              <Button variant="outline" size="sm">Все уроки</Button>
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lessons.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Нет запланированных уроков
              </p>
            ) : (
              lessons.map((l) => {
                const date = new Date(l.scheduled_at)
                const isToday = date.toDateString() === now.toDateString()
                const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()
                const dayLabel = isToday ? "Сегодня" : isTomorrow ? "Завтра" : format(date, "EE, d MMM", { locale: ru })

                return (
                  <div key={l.id} className="flex items-center gap-4 rounded-xl border p-4">
                    {/* Time */}
                    <div className="flex flex-col items-center text-center min-w-[60px]">
                      <span className="text-lg font-bold">{format(date, "HH:mm")}</span>
                      <span className="text-xs text-muted-foreground">{dayLabel}</span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Урок английского</p>
                      <p className="text-sm text-muted-foreground">{l.duration_minutes} мин</p>
                    </div>
                    {/* Action */}
                    {isToday ? (
                      <Link href={`/student/lesson/${l.id}`}>
                        <Button size="sm" className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]">
                          Войти
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline">Перенести</Button>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Progress to next level */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Прогресс до {progress?.english_level === "B2" ? "C1" : "B2"}</CardTitle>
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
                        className="h-full rounded-full bg-gradient-to-r from-[#CC3A3A] to-[#DFED8C]"
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
                {format(now, "LLLL yyyy", { locale: ru })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                  <span key={d} className="py-1 font-medium text-muted-foreground">{d}</span>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <span key={`e-${i}`} className="py-1 text-muted-foreground/30">
                    {new Date(year, month, 0).getDate() - firstDow + i + 1}
                  </span>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === now.getDate()
                  const hasLesson = lessonDays.has(day)
                  return (
                    <span
                      key={day}
                      className={`relative flex size-8 items-center justify-center rounded-lg text-xs ${
                        isToday
                          ? "bg-[#CC3A3A] font-bold text-white"
                          : hasLesson
                            ? "bg-[#DFED8C]/40 font-medium"
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

      {/* === Homework Table === */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Домашние задания</CardTitle>
          <Button variant="outline" size="sm">Все задания</Button>
        </CardHeader>
        <CardContent>
          {homework.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Домашних заданий пока нет
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase text-muted-foreground">Задание</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase text-muted-foreground">Преподаватель</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase text-muted-foreground">Срок сдачи</th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase text-muted-foreground">Статус</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {homework.map((hw: any) => {
                    const st = hwStatus[hw.status] ?? hwStatus.pending
                    return (
                      <tr key={hw.id} className="border-b last:border-0">
                        <td className="py-3 pr-4"><strong>{hw.title}</strong></td>
                        <td className="py-3 pr-4 text-muted-foreground">Преподаватель</td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {format(new Date(hw.due_date), "d MMMM", { locale: ru })}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full px-3 py-0.5 text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <Button size="sm" className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]">Открыть</Button>
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
    </div>
  )
}
