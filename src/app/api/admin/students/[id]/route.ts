import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

// ---------------------------------------------------------------
// GET /api/admin/students/[id]
// Detailed summary of a single student for the admin drawer.
// ---------------------------------------------------------------

export const dynamic = "force-dynamic"

const idSchema = z.string().uuid()

type StudentProgressRow = {
  total_xp: number | null
  current_level: number | null
  lessons_completed: number | null
  current_streak: number | null
  english_level: string | null
  longest_streak: number | null
  updated_at: string | null
}

type StudentRow = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  phone: string | null
  english_goal: string | null
  city: string | null
  occupation: string | null
  role: string | null
  created_at: string
  balance_rub: number | null
  subscription_tier: string | null
  subscription_until: string | null
  user_progress: StudentProgressRow | StudentProgressRow[] | null
}

type LessonTeacherUser = { id: string; full_name: string | null; avatar_url: string | null }
type LessonTeacher = {
  id: string
  user: LessonTeacherUser | LessonTeacherUser[] | null
}
type LastLessonRow = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  teacher: LessonTeacher | LessonTeacher[] | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const { id: rawId } = await params
    const parsed = idSchema.safeParse(rawId)
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректный id" }, { status: 400 })
    }
    const id = parsed.data

    const admin = createAdminClient()

    const { data: student, error: profileErr } = await admin
      .from("profiles")
      .select(
        `
          id, full_name, first_name, last_name, email, avatar_url,
          phone, english_goal, city, occupation, role, created_at,
          balance_rub, subscription_tier, subscription_until,
          user_progress:user_progress!user_progress_user_id_fkey (
            total_xp, current_level, lessons_completed, current_streak,
            english_level, longest_streak, updated_at
          )
        `
      )
      .eq("id", id)
      .eq("role", "student")
      .maybeSingle<StudentRow>()

    if (profileErr) {
      console.error("admin/students/[id] profile error:", profileErr)
      return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 })
    }
    if (!student) {
      return NextResponse.json({ error: "Ученик не найден" }, { status: 404 })
    }

    // Last lesson preview (most recent by scheduled_at).
    const { data: lessons } = await admin
      .from("lessons")
      .select(
        `
          id, scheduled_at, duration_minutes, status,
          teacher:teacher_profiles!lessons_teacher_id_fkey (
            id,
            user:profiles!teacher_profiles_user_id_fkey (
              id, full_name, avatar_url
            )
          )
        `
      )
      .eq("student_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .returns<LastLessonRow[]>()

    const lastLessonRow = Array.isArray(lessons) && lessons.length ? lessons[0] : null
    const teacher = lastLessonRow?.teacher
      ? Array.isArray(lastLessonRow.teacher)
        ? lastLessonRow.teacher[0]
        : lastLessonRow.teacher
      : null
    const teacherUser = teacher?.user
      ? Array.isArray(teacher.user)
        ? teacher.user[0]
        : teacher.user
      : null
    const lastLesson = lastLessonRow
      ? {
          id: lastLessonRow.id,
          scheduled_at: lastLessonRow.scheduled_at,
          duration_minutes: lastLessonRow.duration_minutes,
          status: lastLessonRow.status,
          teacher_name: teacherUser?.full_name ?? null,
          teacher_avatar: teacherUser?.avatar_url ?? null,
        }
      : null

    const up = Array.isArray(student.user_progress)
      ? student.user_progress[0]
      : student.user_progress

    return NextResponse.json({
      student: {
        id: student.id,
        full_name: student.full_name,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        avatar_url: student.avatar_url,
        phone: student.phone,
        english_goal: student.english_goal,
        english_level: up?.english_level ?? null,
        city: student.city,
        occupation: student.occupation,
        created_at: student.created_at,
        balance_rub: student.balance_rub ?? 0,
        subscription_tier: student.subscription_tier ?? "free",
        subscription_until: student.subscription_until ?? null,
        total_xp: up?.total_xp ?? 0,
        current_level: up?.current_level ?? 1,
        lessons_completed: up?.lessons_completed ?? 0,
        current_streak: up?.current_streak ?? 0,
        longest_streak: up?.longest_streak ?? 0,
        last_seen_at: up?.updated_at ?? null,
        last_lesson: lastLesson,
      },
    })
  } catch (err) {
    console.error("Ошибка в /api/admin/students/[id]:", err)
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}
