"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar as CalendarIcon, Video } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { LESSON_JOIN_WINDOW } from "@/lib/constants"
import { differenceInMinutes, isPast } from "date-fns"

interface LessonRow {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  teacher_id: string | null
}

const statusConfig: Record<string, { label: string; className: string }> = {
  booked: {
    label: "Забронирован",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Завершён",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  cancelled: {
    label: "Отменён",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  no_show: {
    label: "Пропущен",
    className: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  },
  in_progress: {
    label: "В процессе",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  pending_payment: {
    label: "Ожидание оплаты",
    className: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function StudentSchedulePage() {
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("upcoming")

  const fetchLessons = useCallback(async (month: Date) => {
    setIsLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const monthStart = startOfMonth(month).toISOString()
    const monthEnd = endOfMonth(month).toISOString()

    const { data } = await supabase
      .from("lessons")
      .select(
        "id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id"
      )
      .eq("student_id", user.id)
      .gte("scheduled_at", monthStart)
      .lte("scheduled_at", monthEnd)
      .order("scheduled_at", { ascending: true })

    setLessons((data as any[]) ?? [])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchLessons(currentMonth)
  }, [currentMonth, fetchLessons])

  const lessonDates = useMemo(() => {
    const dates = new Map<string, string[]>()
    for (const lesson of lessons) {
      const dateKey = format(new Date(lesson.scheduled_at), "yyyy-MM-dd")
      if (!dates.has(dateKey)) dates.set(dateKey, [])
      dates.get(dateKey)!.push(lesson.status)
    }
    return dates
  }, [lessons])

  const selectedDayLessons = useMemo(() => {
    return lessons.filter((l) =>
      isSameDay(new Date(l.scheduled_at), selectedDate)
    )
  }, [lessons, selectedDate])

  const filteredLessons = useMemo(() => {
    const now = new Date()
    switch (filter) {
      case "upcoming":
        return selectedDayLessons.filter(
          (l) =>
            new Date(l.scheduled_at) >= now &&
            l.status !== "cancelled" &&
            l.status !== "completed"
        )
      case "completed":
        return selectedDayLessons.filter((l) => l.status === "completed")
      default:
        return selectedDayLessons
    }
  }, [selectedDayLessons, filter])

  function canJoin(scheduledAt: string, status: string): boolean {
    if (status !== "booked" && status !== "in_progress") return false
    const lessonDate = new Date(scheduledAt)
    const now = new Date()
    const minutesUntil = differenceInMinutes(lessonDate, now)
    return (
      (minutesUntil <= LESSON_JOIN_WINDOW && !isPast(lessonDate)) ||
      status === "in_progress"
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Расписание</h1>
        <p className="text-sm text-muted-foreground">
          Ваши уроки на {format(currentMonth, "LLLL yyyy", { locale: ru })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Calendar */}
        <Card className="w-fit">
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              onMonthChange={setCurrentMonth}
              locale={ru}
              modifiers={{
                hasLesson: (date) =>
                  lessonDates.has(format(date, "yyyy-MM-dd")),
              }}
              modifiersClassNames={{
                hasLesson: "font-bold",
              }}
              components={{
                DayButton: ({ day, modifiers, ...props }) => {
                  const dateKey = format(day.date, "yyyy-MM-dd")
                  const statuses = lessonDates.get(dateKey)

                  return (
                    <button
                      {...props}
                      className={cn(
                        props.className,
                        "relative"
                      )}
                    >
                      {props.children}
                      {statuses && statuses.length > 0 && (
                        <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                          {statuses.slice(0, 3).map((status, i) => (
                            <span
                              key={i}
                              className={cn(
                                "size-1 rounded-full",
                                status === "booked"
                                  ? "bg-blue-500"
                                  : status === "completed"
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                              )}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  )
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Lessons list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-[#CC3A3A]" />
              {format(selectedDate, "d MMMM, EEEE", { locale: ru })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upcoming" onValueChange={setFilter}>
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="upcoming">Предстоящие</TabsTrigger>
                <TabsTrigger value="completed">Завершённые</TabsTrigger>
                <TabsTrigger value="all">Все</TabsTrigger>
              </TabsList>

              <TabsContent value={filter}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-[#CC3A3A]" />
                  </div>
                ) : filteredLessons.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Нет уроков на выбранную дату
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredLessons.map((lesson) => {
                      const scheduledDate = new Date(lesson.scheduled_at)
                      const teacherName = "Преподаватель"
                      const config = statusConfig[lesson.status]
                      const joinable = canJoin(
                        lesson.scheduled_at,
                        lesson.status
                      )

                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                        >
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(teacherName)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex flex-1 flex-col gap-0.5">
                            <p className="text-sm font-medium">
                              {teacherName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(scheduledDate, "HH:mm")} -{" "}
                              {format(
                                new Date(
                                  scheduledDate.getTime() +
                                    lesson.duration_minutes * 60000
                                ),
                                "HH:mm"
                              )}{" "}
                              ({lesson.duration_minutes} мин)
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {config && (
                              <Badge
                                variant="secondary"
                                className={config.className}
                              >
                                {config.label}
                              </Badge>
                            )}

                            {joinable ? (
                              <Link
                                href={`/student/lesson/${lesson.id}`}
                              >
                                <Button
                                  size="sm"
                                  style={{ backgroundColor: "#CC3A3A" }}
                                  className="text-white hover:opacity-90"
                                >
                                  <Video className="size-3.5" />
                                  Войти
                                </Button>
                              </Link>
                            ) : lesson.status === "booked" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                              >
                                <Video className="size-3.5" />
                                Войти
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
