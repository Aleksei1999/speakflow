// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StudentsTableClient } from "./students-table-client"

interface StudentRecord {
  student_id: string
  full_name: string
  avatar_url: string | null
  lessons_completed: number
  next_lesson_at: string | null
  english_level: string | null
  lessons: Array<{
    id: string
    scheduled_at: string
    status: string
    duration_minutes: number
  }>
}

export default async function TeacherStudentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()


  // Verify teacher role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "teacher") redirect("/dashboard")

  // Get all lessons for this teacher with student info
  const { data: lessons } = await supabase
    .from("lessons")
    .select(
      "id, student_id, scheduled_at, status, duration_minutes, student:profiles!lessons_student_id_fkey(id, full_name, avatar_url)"
    )
    .eq("teacher_id", user.id)
    .order("scheduled_at", { ascending: false })

  // Get user_progress for English level
  const studentIds = [
    ...new Set((lessons ?? []).map((l) => l.student_id)),
  ]

  const { data: progressRecords } = studentIds.length
    ? await supabase
        .from("user_progress")
        .select("user_id, english_level, lessons_completed")
        .in("user_id", studentIds)
    : { data: [] }

  const progressMap = new Map(
    (progressRecords ?? []).map((p) => [p.user_id, p])
  )

  // Aggregate by student
  const studentsMap = new Map<string, StudentRecord>()

  for (const lesson of lessons ?? []) {
    const studentData = lesson.student as unknown as {
      id: string
      full_name: string
      avatar_url: string | null
    } | null

    if (!studentData) continue

    const sid = lesson.student_id

    if (!studentsMap.has(sid)) {
      const progress = progressMap.get(sid)
      studentsMap.set(sid, {
        student_id: sid,
        full_name: studentData.full_name,
        avatar_url: studentData.avatar_url,
        lessons_completed: progress?.lessons_completed ?? 0,
        next_lesson_at: null,
        english_level: progress?.english_level ?? null,
        lessons: [],
      })
    }

    const record = studentsMap.get(sid)!
    record.lessons.push({
      id: lesson.id,
      scheduled_at: lesson.scheduled_at,
      status: lesson.status,
      duration_minutes: lesson.duration_minutes,
    })

    // Find next upcoming lesson
    if (
      lesson.status === "booked" &&
      new Date(lesson.scheduled_at) > new Date()
    ) {
      if (
        !record.next_lesson_at ||
        new Date(lesson.scheduled_at) < new Date(record.next_lesson_at)
      ) {
        record.next_lesson_at = lesson.scheduled_at
      }
    }
  }

  const students = Array.from(studentsMap.values())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Мои ученики</h1>
        <p className="text-sm text-muted-foreground">
          {students.length > 0
            ? `Всего учеников: ${students.length}`
            : "Управление учениками"}
        </p>
      </div>

      <StudentsTableClient students={students} />
    </div>
  )
}
