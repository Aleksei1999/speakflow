"use server"

// Server actions для входящих заявок на пробный урок.
//   acceptTrialRequest  — заявка закрепляется за текущим учителем
//   declineTrialRequest — учитель не берёт заявку; она остаётся pending
//                         для других учителей (запись в trial_request_declines).

import { createAdminClient } from "@/lib/supabase/admin"
import { requireTeacher } from "@/lib/teacher/require"
import { invalidateTeacherDashboard, invalidateTeacherStudents } from "@/lib/cache/invalidate"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

export interface TrialActionResult {
  ok: boolean
  error?: string
}

async function resolveTeacherProfileId(userId: string): Promise<string | null> {
  const admin = createAdminClient() as UntypedSupabase
  const { data } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function acceptTrialRequest(requestId: string): Promise<TrialActionResult> {
  if (!requestId) return { ok: false, error: "requestId required" }
  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized" }
  }
  const teacherProfileId = await resolveTeacherProfileId(auth.userId)
  if (!teacherProfileId) return { ok: false, error: "teacher_profiles not found" }

  const admin = createAdminClient() as UntypedSupabase
  // Атомарно назначаем: только если ещё нет assigned_teacher (иначе кто-то опередил).
  const { data, error } = await admin
    .from("trial_lesson_requests")
    .update({
      assigned_teacher_id: teacherProfileId,
      status: "assigned",
    })
    .eq("id", requestId)
    .is("assigned_teacher_id", null)
    .in("status", ["pending", "new"])
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Заявка уже занята другим учителем" }

  invalidateTeacherDashboard(auth.userId)
  invalidateTeacherStudents(auth.userId)
  return { ok: true }
}

export async function declineTrialRequest(requestId: string): Promise<TrialActionResult> {
  if (!requestId) return { ok: false, error: "requestId required" }
  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unauthorized" }
  }
  const teacherProfileId = await resolveTeacherProfileId(auth.userId)
  if (!teacherProfileId) return { ok: false, error: "teacher_profiles not found" }

  const admin = createAdminClient() as UntypedSupabase
  const { error } = await admin
    .from("trial_request_declines")
    .upsert(
      { teacher_id: teacherProfileId, request_id: requestId },
      { onConflict: "teacher_id,request_id" },
    )
  if (error) return { ok: false, error: error.message }

  invalidateTeacherDashboard(auth.userId)
  return { ok: true }
}
