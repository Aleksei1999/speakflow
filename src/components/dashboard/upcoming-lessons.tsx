"use client"

import Link from "next/link"
import { format, differenceInMinutes, isPast } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar, Clock, Video } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LESSON_JOIN_WINDOW } from "@/lib/constants"

export interface LessonItem {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  jitsi_room_name: string | null
  price: number
  student?: { full_name: string; avatar_url: string | null } | null
  teacher?: { full_name: string; avatar_url: string | null } | null
}

interface UpcomingLessonsProps {
  lessons: LessonItem[]
  userRole: "student" | "teacher"
  title?: string
  showViewAll?: boolean
  showJoinButton?: boolean
  viewAllHref?: string
}

const statusLabels: Record<string, string> = {
  pending_payment: "Ожидание оплаты",
  booked: "Забронирован",
  in_progress: "В процессе",
  completed: "Завершён",
  cancelled: "Отменён",
  no_show: "Пропущен",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function canJoin(scheduledAt: string, status: string): boolean {
  if (status !== "booked" && status !== "in_progress") return false
  const lessonDate = new Date(scheduledAt)
  const now = new Date()
  const minutesUntil = differenceInMinutes(lessonDate, now)
  return (minutesUntil <= LESSON_JOIN_WINDOW && !isPast(lessonDate)) ||
    status === "in_progress"
}

export function UpcomingLessons({
  lessons,
  userRole,
  title = "Предстоящие уроки",
  showViewAll = true,
  showJoinButton = true,
  viewAllHref,
}: UpcomingLessonsProps) {
  const defaultHref =
    userRole === "teacher" ? "/teacher/schedule" : "/student/schedule"

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-4 text-[#722F37]" />
          {title}
        </CardTitle>
        {showViewAll && (
          <Link href={viewAllHref ?? defaultHref}>
            <Button variant="link" size="sm">
              Все уроки
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-2 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {userRole === "teacher"
                ? "На сегодня уроков нет"
                : "Нет предстоящих уроков"}
            </p>
          </div>
        ) : (
          lessons.map((lesson) => {
            const person =
              userRole === "teacher" ? lesson.student : lesson.teacher
            const personName = person?.full_name ?? (
              userRole === "teacher" ? "Ученик" : "Преподаватель"
            )
            const initials = getInitials(personName)
            const scheduledDate = new Date(lesson.scheduled_at)
            const joinable = canJoin(lesson.scheduled_at, lesson.status)

            return (
              <div
                key={lesson.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <Avatar>
                  {person?.avatar_url ? (
                    <AvatarImage
                      src={person.avatar_url}
                      alt={personName}
                    />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>

                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{personName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(scheduledDate, "d MMMM, EEEE", { locale: ru })}{" "}
                    {format(scheduledDate, "HH:mm")}{" "}
                    <span className="text-muted-foreground/70">
                      ({lesson.duration_minutes} мин)
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      joinable
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : ""
                    }
                  >
                    {statusLabels[lesson.status] ?? lesson.status}
                  </Badge>

                  {showJoinButton && (
                    joinable && lesson.jitsi_room_name ? (
                      <Link href={`/lesson/${lesson.jitsi_room_name}`}>
                        <Button
                          size="sm"
                          style={{ backgroundColor: "#722F37" }}
                          className="text-white hover:opacity-90"
                        >
                          <Video className="size-3.5" />
                          Войти
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        <Video className="size-3.5" />
                        Войти
                      </Button>
                    )
                  )}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
