// @ts-nocheck
// Fan-out notifications when a lesson is booked or cancelled.
// Both student and teacher get the message via their preferred channel(s)
// (email + telegram). All calls are fire-and-forget — never throw out of
// here, never block the API response.

import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotification } from "@/lib/notifications/service"

function moscow(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return { date: "", time: "" }
    const date = new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      timeZone: "Europe/Moscow",
    }).format(d)
    const time = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(d)
    return { date, time: `${time} МСК` }
  } catch {
    return { date: "", time: "" }
  }
}

export async function notifyLessonBooked(args: {
  lessonId: string
}): Promise<void> {
  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, student_id, teacher_id, scheduled_at, duration_minutes")
    .eq("id", args.lessonId)
    .maybeSingle()
  if (!lesson) return

  // teacher_id on lessons points to teacher_profiles.id; resolve to user_id.
  const { data: tp } = await admin
    .from("teacher_profiles")
    .select("user_id")
    .eq("id", lesson.teacher_id)
    .maybeSingle()
  const teacherUserId = tp?.user_id ?? null

  const ids = [lesson.student_id, teacherUserId].filter(Boolean) as string[]
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids)
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  const studentName = byId.get(lesson.student_id)?.full_name || "Ученик"
  const teacherName = teacherUserId
    ? byId.get(teacherUserId)?.full_name || "Преподаватель"
    : "Преподаватель"

  const { date, time } = moscow(lesson.scheduled_at)

  // Notify student
  void sendNotification(lesson.student_id, "booking_confirmation", {
    studentName,
    teacherName,
    date,
    time,
    duration: lesson.duration_minutes ?? 50,
  }).catch(() => {})

  if (teacherUserId) {
    void sendNotification(teacherUserId, "booking_confirmation", {
      studentName,
      teacherName,
      date,
      time,
      duration: lesson.duration_minutes ?? 50,
    }).catch(() => {})
  }
}

export async function notifyLessonCancelled(args: {
  lessonId: string
  cancelledByUserId: string
  reason?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from("lessons")
    .select(
      "id, student_id, teacher_id, scheduled_at, duration_minutes, cancelled_by, cancellation_reason"
    )
    .eq("id", args.lessonId)
    .maybeSingle()
  if (!lesson) return

  const { data: tp } = await admin
    .from("teacher_profiles")
    .select("user_id")
    .eq("id", lesson.teacher_id)
    .maybeSingle()
  const teacherUserId = tp?.user_id ?? null

  const ids = [
    lesson.student_id,
    teacherUserId,
    args.cancelledByUserId,
  ].filter(Boolean) as string[]
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids)
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  const cancelledByName =
    byId.get(args.cancelledByUserId)?.full_name || "Собеседник"
  const studentName = byId.get(lesson.student_id)?.full_name || "Ученик"
  const teacherName = teacherUserId
    ? byId.get(teacherUserId)?.full_name || "Преподаватель"
    : "Преподаватель"

  const { date, time } = moscow(lesson.scheduled_at)

  // Send to whichever side did NOT cancel.
  const recipients: string[] = []
  if (lesson.student_id !== args.cancelledByUserId) {
    recipients.push(lesson.student_id)
  }
  if (teacherUserId && teacherUserId !== args.cancelledByUserId) {
    recipients.push(teacherUserId)
  }

  for (const uid of recipients) {
    void sendNotification(uid, "lesson_cancelled" as any, {
      studentName,
      teacherName,
      cancelledByName,
      date,
      time,
      duration: lesson.duration_minutes ?? 50,
      reason: args.reason ?? lesson.cancellation_reason ?? null,
    }).catch(() => {})
  }
}
