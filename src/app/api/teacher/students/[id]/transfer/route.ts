import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { teacherHasStudent } from "@/lib/materials/access"
import { logAuditEvent } from "@/lib/audit/log"
import { invalidateTeacherStudents, invalidateStudentDashboard, invalidateTeacherDashboard } from "@/lib/cache/invalidate"
import { notifyAdminsTelegram, notifyUserTelegram } from "@/lib/telegram/notify-admins"
import { escapeHtml } from "@/lib/html/escape"

// POST /api/teacher/students/[id]/transfer — передать ученика другому преподавателю.
// Переносятся будущие уроки (booked / pending_payment) и активная пробная заявка.
// Урок, который у нового преподавателя пересекается с занятым слотом, отменяется
// с причиной — об этом сообщаем в ответе.

const BodySchema = z.object({
  toTeacherUserId: z.string().uuid(),
  reason: z.string().trim().min(3, "Укажите причину").max(1000),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: studentId } = await ctx.params
  if (!z.string().uuid().safeParse(studentId).success) return NextResponse.json({ error: "Некорректный id ученика" }, { status: 400 })
  const body = BodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 })
  const { toTeacherUserId, reason } = body.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle<{ role: string; full_name: string | null }>()
  if (!me || (me.role !== "teacher" && me.role !== "admin")) return NextResponse.json({ error: "Доступ только преподавателю" }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: toTp } = await admin.from("teacher_profiles").select("id, user_id").eq("user_id", toTeacherUserId).maybeSingle()
  if (!toTp) return NextResponse.json({ error: "Преподаватель не найден" }, { status: 404 })
  const { data: toProfile } = await admin.from("profiles").select("full_name, is_active").eq("id", toTeacherUserId).maybeSingle()
  if (!toProfile?.is_active) return NextResponse.json({ error: "Преподаватель отключён от платформы" }, { status: 400 })

  // От кого передаём: учитель — от себя; админ — от текущего преподавателя ученика.
  let fromTpId: string | null = null
  if (me.role === "teacher") {
    const { data: tp } = await admin.from("teacher_profiles").select("id").eq("user_id", user.id).maybeSingle()
    fromTpId = tp?.id ?? null
    if (!fromTpId || !(await teacherHasStudent(admin, fromTpId, studentId))) return NextResponse.json({ error: "Это не ваш ученик" }, { status: 403 })
  } else {
    const { data: last } = await admin.from("lessons").select("teacher_id").eq("student_id", studentId).in("status", ["booked", "in_progress", "completed", "pending_payment"]).order("scheduled_at", { ascending: false }).limit(1).maybeSingle()
    fromTpId = last?.teacher_id ?? null
    if (!fromTpId) return NextResponse.json({ error: "У ученика нет преподавателя" }, { status: 400 })
  }
  if (fromTpId === toTp.id) return NextResponse.json({ error: "Ученик уже у этого преподавателя" }, { status: 400 })

  const nowIso = new Date().toISOString()
  const { data: future } = await admin
    .from("lessons")
    .select("id, scheduled_at")
    .eq("student_id", studentId)
    .eq("teacher_id", fromTpId)
    .in("status", ["booked", "pending_payment"])
    .gt("scheduled_at", nowIso)
  let moved = 0
  let cancelled = 0
  for (const l of (future ?? []) as Array<{ id: string; scheduled_at: string }>) {
    const { error } = await admin.from("lessons").update({ teacher_id: toTp.id, google_event_id: null }).eq("id", l.id)
    if (!error) { moved += 1; continue }
    if (error.code === "23P01" || error.code === "23505") {
      await admin.from("lessons").update({ status: "cancelled", cancelled_by: user.id, cancellation_reason: "Передача ученика: у нового преподавателя это время занято" }).eq("id", l.id)
      cancelled += 1
    } else {
      console.error("[transfer] lesson move failed", l.id, error)
    }
  }
  await admin.from("trial_lesson_requests").update({ assigned_teacher_id: toTp.id }).eq("user_id", studentId).eq("assigned_teacher_id", fromTpId).in("status", ["assigned", "scheduled"])

  const { data: transfer } = await admin
    .from("student_transfers")
    .insert({ student_id: studentId, from_teacher_id: fromTpId, to_teacher_id: toTp.id, initiated_by: user.id, reason, lessons_moved: moved, lessons_cancelled: cancelled })
    .select("id")
    .single()

  const { data: fromTp } = await admin.from("teacher_profiles").select("user_id").eq("id", fromTpId).maybeSingle()
  const { data: student } = await admin.from("profiles").select("full_name").eq("id", studentId).maybeSingle()
  invalidateTeacherStudents(toTeacherUserId)
  if (fromTp?.user_id) { invalidateTeacherStudents(fromTp.user_id); invalidateTeacherDashboard(fromTp.user_id) }
  invalidateTeacherDashboard(toTeacherUserId)
  invalidateStudentDashboard(studentId)

  await logAuditEvent(req, {
    category: "data",
    action: "student_transferred",
    target_type: "student_transfers",
    target_id: transfer?.id ?? studentId,
    payload: { student_id: studentId, from_teacher_id: fromTpId, to_teacher_id: toTp.id, lessons_moved: moved, lessons_cancelled: cancelled },
  })

  const sName = escapeHtml(student?.full_name ?? "Ученик")
  const toName = escapeHtml(toProfile.full_name ?? "преподаватель")
  const fromName = escapeHtml(me.full_name ?? "преподаватель")
  const safeReason = escapeHtml(reason)
  const text =
    `🔁 <b>Передача ученика</b>\n${sName} → ${toName}\n` +
    `От: ${fromName}\nПричина: ${safeReason}\n` +
    `Перенесено уроков: ${moved}${cancelled ? `, отменено из-за занятого времени: ${cancelled}` : ""}`
  void notifyAdminsTelegram(text)
  void notifyUserTelegram(toTeacherUserId, `👋 Вам передан ученик: <b>${sName}</b>\nПричина: ${safeReason}\nБудущих уроков перенесено: ${moved}`)

  return NextResponse.json({ ok: true, lessonsMoved: moved, lessonsCancelled: cancelled })
}
