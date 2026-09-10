// Гейт «участник урока» для /api/lesson/*: проверяет auth и связь caller'а
// с уроком (student / teacher / admin), не доверяя lessonId/userId из body.
// IMPORTANT: service-role `admin` из результата использовать только ПОСЛЕ гейта.

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
  status: 400 | 401 | 403 | 404 | 409 | 500
  error: string
}

/**
 * Статусы, при которых WRITE-операции по уроку запрещены.
 * Чтение истории остаётся доступным (для просмотра завершённых уроков).
 */
const INACTIVE_LESSON_STATUSES = new Set(["cancelled", "no_show", "completed"])

export type LessonGateOptions = {
  /**
   * Если true — гейт возвращает 409 для урока в статусе
   * cancelled | no_show | completed. По умолчанию false
   * (исторический доступ нужен GET-эндпоинтам).
   *
   * Используй в WRITE-эндпоинтах: chat, notes, materials,
   * homework, upload, recording.* — чтобы участники
   * отменённого/завершённого урока не могли продолжать в него писать.
   */
  requireActive?: boolean
}

export async function requireLessonParticipant(
  lessonId: string | null | undefined,
  options: LessonGateOptions = {}
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

  // Явно реджектим DB-ошибки — иначе они молча превращались в
  // profileRole='student' и admin/teacher получал ограниченный доступ.
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: Role | null }>()
  if (profileErr) {
    console.error("[lesson-auth] profile lookup failed", profileErr)
    return { ok: false, status: 500, error: "Profile lookup failed" }
  }
  const profileRole = (profile?.role as Role | undefined) ?? "student"

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

  // teacher_profiles.id нужен и для авторизации, и чтобы teacher-роуты
  // писали teacher_id, не доверяя body.
  let teacherProfileId: string | null = null
  if (profileRole === "teacher") {
    const { data: tp, error: tpErr } = await admin
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>()
    if (tpErr) {
      console.error("[lesson-auth] teacher_profiles lookup failed", tpErr)
      return { ok: false, status: 500, error: "Teacher profile lookup failed" }
    }
    teacherProfileId = tp?.id ?? null
  }

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

  // Активность урока — опционально. Админу тоже не даём, чтобы
  // случайно не подложить домашку/материал в архивный урок: пусть
  // открывает запись урока, а не пишет в неё.
  if (options.requireActive) {
    const status = (lesson.status ?? "").toLowerCase()
    if (INACTIVE_LESSON_STATUSES.has(status)) {
      return {
        ok: false,
        status: 409,
        error: "Урок недоступен для изменений (отменён или завершён)",
      }
    }
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
  lessonId: string | null | undefined,
  options: LessonGateOptions = {}
): Promise<LessonGateOk | LessonGateFail> {
  const gate = await requireLessonParticipant(lessonId, options)
  if (!gate.ok) return gate
  if (gate.role !== "teacher" && gate.role !== "admin") {
    return { ok: false, status: 403, error: "Только преподаватель урока или админ" }
  }
  return gate
}
