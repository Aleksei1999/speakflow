// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedStudentDashboard } from "@/lib/dashboard/student"
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
  try {
    dashboard = await getCachedStudentDashboard(user.id)
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
  const balance = 0 // placeholder — реального поля balance в снапшоте пока нет
  const upcomingLessons = dashboard?.upcoming_lessons ?? []
  const stats = dashboard?.stats ?? {
    total_lessons: 0,
    completed: 0,
    cancelled: 0,
    upcoming: 0,
    completed_30d: 0,
    month_total: 0,
  }

  return (
    <StudentRawDashboard
      studentId={user.id}
      firstName={firstName}
      lastName={lastName}
      avatarUrl={avatarUrl}
      englishLevel={englishLevel}
      balance={balance}
      lessonsThisYear={stats.total_lessons}
      initialLessons={upcomingLessons.map((l) => ({
        id: l.id,
        scheduledAt: l.scheduled_at,
        durationMinutes: l.duration_minutes ?? 50,
        status: l.status,
        teacherName: l.teacher_name,
        teacherAvatar: l.teacher_avatar,
        meetingUrl: null,
      }))}
    />
  )
}
