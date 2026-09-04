// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedStudentDashboard } from "@/lib/dashboard/student"
import { fetchChatList } from "@/lib/chat/list"
import { getStudentCalendarConnection } from "./calendar-actions"
import StudentRawDashboard from "./StudentRawDashboard"

export const dynamic = "force-dynamic"

export default async function StudentNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "student") {
    if (role === "teacher" || role === "admin") redirect("/teacher")
    redirect("/login")
  }

  // Один RPC — тот же loader, что стоял в старом (dashboard)/student/page.tsx.
  // fail-soft: если RPC упадёт — рендерим дашборд с mock-данными.
  let dashboard: Awaited<ReturnType<typeof getCachedStudentDashboard>> | null = null
  let initialChats: Awaited<ReturnType<typeof fetchChatList>> = []
  let balanceKopecks = 0
  try {
    ;[dashboard, initialChats] = await Promise.all([
      getCachedStudentDashboard(user.id),
      fetchChatList({ includeGroups: true }),
    ])
    // student_balances может быть пустым (не пополнял ни разу) — fallback 0.
    const { data: balRow } = await supabase
      .from("student_balances")
      .select("balance_kopecks")
      .eq("user_id", user.id)
      .maybeSingle()
    if (balRow?.balance_kopecks) balanceKopecks = Number(balRow.balance_kopecks)
  } catch (e) {
    console.error("[student] dashboard fetch failed", e)
  }

  // Первое имя из full_name (для приветствия/автарки).
  const fullName = dashboard?.profile?.full_name ?? "Ученик"
  const firstName = fullName.split(" ")[0]
  const lastName = fullName.split(" ").slice(1).join(" ")
  const avatarUrl = dashboard?.profile?.avatar_url ?? null
  const englishLevel =
    dashboard?.progress?.english_level ?? "A1"
  // Баланс в рублях (округляем копейки к рублю, для UI).
  const balance = Math.round(balanceKopecks / 100)
  const upcomingLessons = dashboard?.upcoming_lessons ?? []
  const stats = dashboard?.stats ?? {
    total_lessons: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    completed_30d: 0,
    month_total: 0,
  }

  const currentStreak = dashboard?.progress?.current_streak ?? 0

  const calendarConnection = await getStudentCalendarConnection()

  return (
    <StudentRawDashboard
      studentId={user.id}
      calendarConnection={calendarConnection}
      firstName={firstName}
      lastName={lastName}
      avatarUrl={avatarUrl}
      englishLevel={englishLevel}
      currentStreak={currentStreak}
      balance={balance}
      lessonsThisYear={stats.total_lessons}
      initialLessons={upcomingLessons.map((l) => ({
        id: l.id,
        scheduledAt: l.scheduled_at,
        durationMinutes: l.duration_minutes ?? 50,
        status: l.status,
        teacherName: l.teacher_name,
        teacherAvatar: l.teacher_avatar,
        teacherUserId: l.teacher_user_id,
        meetingUrl: null,
      }))}
      initialChats={initialChats}
    />
  )
}
