// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeLessonAccess } from "@/lib/lesson-access"
import LessonVideoRoom from "@/components/lesson/LessonVideoRoom"

export const dynamic = "force-dynamic"

export default async function LessonRoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/login")

  const admin = createAdminClient() as any
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, scheduled_at, duration_minutes, status, teacher_id, student_id")
    .eq("id", id)
    .maybeSingle()
  if (!lesson) {
    // Урок не найден — уводим в дашборд по роли, а не на публичный лендинг.
    if (profile.role === "teacher") redirect("/teacher")
    if (profile.role === "admin") redirect("/admin")
    redirect("/student")
  }

  const isAdmin = profile.role === "admin"

  // teacher_id в lessons → teacher_profiles.id → user_id.
  const { data: teacherProfile } = await admin
    .from("teacher_profiles")
    .select("user_id")
    .eq("id", lesson.teacher_id)
    .maybeSingle()
  const teacherUserId: string | null = teacherProfile?.user_id ?? null

  const isTeacher = !!teacherUserId && teacherUserId === user.id
  const isStudent = lesson.student_id === user.id
  if (!isTeacher && !isStudent && !isAdmin) {
    if (profile.role === "teacher") redirect("/teacher")
    if (profile.role === "student") redirect("/student")
    redirect("/")
  }

  const access = computeLessonAccess({
    scheduledAt: lesson.scheduled_at,
    durationMinutes: lesson.duration_minutes ?? 50,
    status: lesson.status,
  })
  if (access.status === "cancelled") redirect(isTeacher || isAdmin ? "/teacher" : "/student")

  // Профиль ученика для модалки «О последнем уроке» + уровень + профиль учителя для чата.
  const [sp, progressRow, tp] = await Promise.all([
    lesson.student_id
      ? admin.from("profiles").select("full_name, avatar_url").eq("id", lesson.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
    lesson.student_id
      ? admin.from("user_progress").select("english_level").eq("user_id", lesson.student_id).maybeSingle()
      : Promise.resolve({ data: null }),
    teacherUserId
      ? admin.from("profiles").select("full_name, avatar_url").eq("id", teacherUserId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const studentName = sp?.data?.full_name || "Ученик"
  const studentAvatar = sp?.data?.avatar_url ?? null
  const studentLevel = (progressRow?.data?.english_level ?? "A1").toString().toUpperCase()
  const teacherName = tp?.data?.full_name || "Учитель"
  const teacherAvatar = tp?.data?.avatar_url ?? null

  const backHref = isTeacher || isAdmin ? "/teacher" : "/student"

  return (
    <LessonVideoRoom
      lessonId={lesson.id}
      userId={profile.id}
      isTeacher={isTeacher || isAdmin}
      studentId={lesson.student_id ?? ""}
      studentName={studentName}
      studentLevel={studentLevel}
      studentAvatar={studentAvatar}
      teacherUserId={teacherUserId ?? ""}
      teacherName={teacherName}
      teacherAvatar={teacherAvatar}
      backHref={backHref}
    />
  )
}
