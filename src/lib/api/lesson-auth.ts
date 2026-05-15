// ---------------------------------------------------------------
// Lesson participant gate for API routes.
//
// Stops the auth bypass that existed in /api/lesson/* routes — those
// routes used createAdminClient() and trusted lessonId/userId from the
// request body, which let any logged-in user read or write to any
// lesson by guessing/seeing a lessonId in the URL.
//
// Usage:
//   const gate = await requireLessonParticipant(lessonId)
//   if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
//   const { user, lesson, role, admin } = gate
//
// `role` is one of "student" | "teacher" | "admin" — admin is allowed
// because back-office actions are intentionally bypassing RLS.
// `admin` is the service-role client, returned only AFTER auth passed.
// ---------------------------------------------------------------

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

type Role = "student" | "teacher" | "admin"

type LessonRow = {
  id: string
  student_id: string | null
  teacher_id: string | null
  status: string | null
  scheduled_at: string | null
  duration_minutes: number | null
}

export type LessonGateOk = {
  ok: true
  user: { id: string; email?: string | null }
  /** profiles.role of the caller — useful for branching teacher/admin POSTs. */
  profileRole: Role
  /** how the caller is related to THIS lesson. */
  role: Role
  lesson: LessonRow
  /** teacher_profiles.id of the caller, when profileRole === "teacher". */
  teacherProfileId: string | null
  /** Service-role client. ONLY use it AFTER this gate has passed. */
  admin: ReturnType<typeof createAdminClient>
}
export type LessonGateFail = {
  ok: false
  status: 400 | 401 | 403 | 404 | 500
  error: string
}

export async function requireLessonParticipant(
  lessonId: string | null | undefined
): Promise<LessonGateOk | LessonGateFail> {
  if (!lessonId || typeof lessonId !== "string") {
    return { ok: false, status: 400, error: "Missing lessonId" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, error: "Не авторизован" }
  }

  const admin = createAdminClient()

  // 1. Caller's profile role.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role | null }>()
  const profileRole = (profile?.role as Role | undefined) ?? "student"

  // 2. Lesson lookup. Use admin client — we'll authorise manually below.
  const { data: lesson, error: lessonErr } = await admin
    .from("lessons")
    .select("id, student_id, teacher_id, status, scheduled_at, duration_minutes")
    .eq("id", lessonId)
    .maybeSingle<LessonRow>()
  if (lessonErr) {
    return { ok: false, status: 500, error: "Lesson lookup failed" }
  }
  if (!lesson) {
    return { ok: false, status: 404, error: "Урок не найден" }
  }

  // 3. teacher_profiles.id — needed both to authorise teachers and to
  //    let teacher routes write the right teacher_id without trusting
  //    the body.
  let teacherProfileId: string | null = null
  if (profileRole === "teacher") {
    const { data: tp } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>()
    teacherProfileId = tp?.id ?? null
  }

  // 4. Resolve relationship to THIS lesson.
  let role: Role | null = null
  if (profileRole === "admin") {
    role = "admin"
  } else if (lesson.student_id === user.id) {
    role = "student"
  } else if (
    profileRole === "teacher" &&
    teacherProfileId &&
    lesson.teacher_id === teacherProfileId
  ) {
    role = "teacher"
  }

  if (!role) {
    return { ok: false, status: 403, error: "Нет доступа к этому уроку" }
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email ?? null },
    profileRole,
    role,
    lesson,
    teacherProfileId,
    admin,
  }
}

/**
 * Тот же гейт, но требует чтобы caller был именно teacher/admin
 * (студенты не имеют права POST'ить материалы / homework).
 */
export async function requireLessonTeacherOrAdmin(
  lessonId: string | null | undefined
): Promise<LessonGateOk | LessonGateFail> {
  const gate = await requireLessonParticipant(lessonId)
  if (!gate.ok) return gate
  if (gate.role !== "teacher" && gate.role !== "admin") {
    return { ok: false, status: 403, error: "Только преподаватель урока или админ" }
  }
  return gate
}
