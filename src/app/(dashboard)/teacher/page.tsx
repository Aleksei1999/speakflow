// @ts-nocheck
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"
import {
  DollarSign,
  BookOpen,
  Star,
  Users,
  TrendingUp,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UpcomingLessons } from "@/components/dashboard/upcoming-lessons"
import { EarningsChart } from "@/components/dashboard/earnings-chart"
import type { LessonItem } from "@/components/dashboard/upcoming-lessons"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function renderStars(rating: number) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`size-3.5 ${
          i <= Math.round(rating)
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground/30"
        }`}
      />
    )
  }
  return stars
}

export default async function TeacherDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Verify teacher role
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "teacher") redirect("/student")

  // Fetch teacher profile
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // Today's lessons with student info
  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const todayEnd = endOfDay(now).toISOString()

  const { data: todayLessons } = await supabase
    .from("lessons")
    .select("*, student:profiles!lessons_student_id_fkey(full_name, avatar_url)")
    .eq("teacher_id", user.id)
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd)
    .order("scheduled_at", { ascending: true })

  // Monthly earnings (current month)
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const { data: monthPayments } = await supabase
    .from("payments")
    .select("amount, lessons!inner(teacher_id)")
    .eq("lessons.teacher_id", user.id)
    .eq("status", "succeeded")
    .gte("paid_at", monthStart)
    .lte("paid_at", monthEnd)

  const monthlyEarnings =
    monthPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0

  // Earnings for last 6 months chart
  const earningsData = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const mStart = startOfMonth(monthDate).toISOString()
    const mEnd = endOfMonth(monthDate).toISOString()

    const { data: mPayments } = await supabase
      .from("payments")
      .select("amount, lessons!inner(teacher_id)")
      .eq("lessons.teacher_id", user.id)
      .eq("status", "succeeded")
      .gte("paid_at", mStart)
      .lte("paid_at", mEnd)

    earningsData.push({
      month: format(monthDate, "LLL", { locale: ru }),
      amount:
        (mPayments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0) / 100,
    })
  }

  // Active students count (unique students with booked or completed lessons)
  const { data: activeStudents } = await supabase
    .from("lessons")
    .select("student_id")
    .eq("teacher_id", user.id)
    .in("status", ["booked", "completed", "in_progress"])

  const uniqueStudentIds = new Set(
    activeStudents?.map((l) => l.student_id) ?? []
  )

  // Recent reviews - query from a reviews table if it exists,
  // otherwise we'll show a placeholder. Since the DB types don't include
  // a reviews table, we'll create a reasonable empty state.
  // For now, we approximate reviews data.

  // Format lessons for the UpcomingLessons component
  const formattedLessons: LessonItem[] = (todayLessons ?? []).map((l) => ({
    id: l.id,
    scheduled_at: l.scheduled_at,
    duration_minutes: l.duration_minutes,
    status: l.status,
    jitsi_room_name: l.jitsi_room_name,
    price: l.price,
    student: l.student
      ? {
          full_name: (l.student as { full_name: string; avatar_url: string | null }).full_name,
          avatar_url: (l.student as { full_name: string; avatar_url: string | null }).avatar_url,
        }
      : null,
  }))

  const stats = [
    {
      title: "Заработок за месяц",
      value: new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(monthlyEarnings / 100),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Уроков проведено",
      value: teacherProfile?.total_lessons?.toString() ?? "0",
      icon: BookOpen,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Средний рейтинг",
      value: teacherProfile?.rating?.toFixed(1) ?? "0.0",
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      stars: teacherProfile?.rating ?? 0,
    },
    {
      title: "Активных учеников",
      value: uniqueStudentIds.size.toString(),
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Добро пожаловать, {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(now, "d MMMM yyyy, EEEE", { locale: ru })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}
              >
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-bold">{stat.value}</p>
                  {stat.stars !== undefined && (
                    <div className="flex">{renderStars(stat.stars)}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's schedule */}
        <div className="lg:col-span-2">
          <UpcomingLessons
            lessons={formattedLessons}
            userRole="teacher"
            title="Расписание на сегодня"
            showJoinButton
            viewAllHref="/teacher/schedule"
          />
        </div>

        {/* Recent reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-4 text-[#CC3A3A]" />
              Последние отзывы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacherProfile && teacherProfile.total_reviews > 0 ? (
              <div className="space-y-4">
                {/* Reviews would be fetched from a reviews table */}
                <p className="text-sm text-muted-foreground">
                  У вас {teacherProfile.total_reviews}{" "}
                  {teacherProfile.total_reviews === 1
                    ? "отзыв"
                    : teacherProfile.total_reviews < 5
                      ? "отзыва"
                      : "отзывов"}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(teacherProfile.rating)}</div>
                  <span className="text-sm font-medium">
                    {teacherProfile.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Пока нет отзывов
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Отзывы появятся после завершения уроков
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Earnings chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[#CC3A3A]" />
            Динамика заработка
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EarningsChart data={earningsData} />
        </CardContent>
      </Card>
    </div>
  )
}
