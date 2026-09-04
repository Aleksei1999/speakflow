// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedStudentDashboard } from "@/lib/dashboard/student"
import StudentSchedulePage from "./StudentSchedulePage"

export const dynamic = "force-dynamic"

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (role !== "student") redirect("/login")

  let dashboard: Awaited<ReturnType<typeof getCachedStudentDashboard>> | null = null
  try {
    dashboard = await getCachedStudentDashboard(user.id)
  } catch (e) {
    console.error("[student/schedule] load failed", e)
  }

  const upcoming = (dashboard?.upcoming_lessons ?? []).map((l) => ({
    id: l.id,
    scheduledAt: l.scheduled_at,
    durationMinutes: l.duration_minutes ?? 50,
    status: l.status,
    teacherName: l.teacher_name,
  }))

  return <StudentSchedulePage studentId={user.id} initialLessons={upcoming} />
}
