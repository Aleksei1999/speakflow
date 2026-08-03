// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { loadTeacherStudents } from "@/lib/teacher/students"
import TeacherRawDashboard from "./TeacherRawDashboard"

export const dynamic = "force-dynamic"

export default async function TeacherNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "teacher" && role !== "admin") {
    if (role === "student") redirect("/student")
    redirect("/login")
  }

  // Резолвим teacher_profiles.id и грузим учеников по lessons-связке.
  const { data: tp } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  const students = tp?.id
    ? await loadTeacherStudents(supabase, tp.id)
    : []

  return <TeacherRawDashboard initialStudents={students} teacherId={user.id} />
}
