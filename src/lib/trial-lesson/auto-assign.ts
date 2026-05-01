// @ts-nocheck
// Auto-assigns a trial lesson to a free teacher when a student finishes
// signup. Idempotent: safe to call multiple times.
//
// Behaviour:
//   1. If the user already has a non-final trial_lesson_requests row, do
//      nothing destructive — just return that row's status.
//   2. Otherwise insert a fresh trial_lesson_requests row.
//   3. If preferredSlot is given, call find_trial_teacher; if a teacher is
//      found, create a lessons row (status='booked', price=0,
//      duration=30 min) and mark the request 'scheduled' with assigned_*.
//   4. Telegram notification to admins is fire-and-forget.

import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"

export type TrialAutoAssignResult = {
  requestId: string
  reused: boolean
  status: "pending" | "scheduled" | "assigned" | "completed" | "cancelled"
  lessonId: string | null
  teacherUserId: string | null
}

const TRIAL_DURATION_MIN = 30

export async function autoAssignTrial(args: {
  userId: string
  preferredSlot: string | null
  notes?: string | null
  levelTestId?: string | null
  /**
   * Если ученик уже выбрал конкретного преподавателя в UI — назначаем его
   * (после проверки, что слот реально его и нет overlap'a). Иначе берём
   * первого по find_trial_teacher.
   */
  teacherProfileId?: string | null
}): Promise<TrialAutoAssignResult | null> {
  const { userId } = args
  const admin = createAdminClient()

  // Dedupe: any open trial request for this user wins.
  const { data: existing } = await admin
    .from("trial_lesson_requests")
    .select("id, status, assigned_teacher_id, assigned_lesson_id, preferred_slot")
    .eq("user_id", userId)
    .in("status", ["pending", "assigned", "scheduled"])
    .maybeSingle()

  if (existing) {
    return {
      requestId: existing.id,
      reused: true,
      status: existing.status,
      lessonId: existing.assigned_lesson_id ?? null,
      teacherUserId: existing.assigned_teacher_id ?? null,
    }
  }

  // 1) Create the request row.
  const { data: inserted, error: insertErr } = await admin
    .from("trial_lesson_requests")
    .insert({
      user_id: userId,
      level_test_id: args.levelTestId ?? null,
      notes: args.notes ?? null,
      preferred_slot: args.preferredSlot ?? null,
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    console.error("[autoAssignTrial] insert failed", insertErr)
    return null
  }

  const requestId = inserted.id

  // 2) Try to assign a teacher when a slot was provided.
  let lessonId: string | null = null
  let teacherUserId: string | null = null
  let teacherProfileIdAssigned: string | null = null
  let status: TrialAutoAssignResult["status"] = "pending"

  if (args.preferredSlot) {
    let teacherProfileId: string | null = null
    let chosenSource: "explicit" | "fallback" | "none" = "none"

    console.log("[autoAssignTrial] start", {
      requestId,
      userId,
      preferredSlot: args.preferredSlot,
      explicitTeacher: args.teacherProfileId ?? null,
    })

    // 1) Если фронт прислал явного преподавателя — валидируем его через
    // list_trial_teachers (свободен ли он на этот слот).
    if (args.teacherProfileId) {
      const { data: candidates, error: rpcErr } = await admin.rpc(
        "list_trial_teachers",
        {
          p_slot: args.preferredSlot,
          p_duration: TRIAL_DURATION_MIN,
          p_tz: "Europe/Moscow",
        }
      )
      if (rpcErr) {
        console.error("[autoAssignTrial] list_trial_teachers rpc error", rpcErr)
      }
      const list = Array.isArray(candidates) ? candidates : []
      console.log("[autoAssignTrial] list_trial_teachers returned", {
        count: list.length,
        ids: list.map((c: any) => c.teacher_profile_id),
      })
      const match = list.find(
        (c: any) => c.teacher_profile_id === args.teacherProfileId
      )
      if (match) {
        teacherProfileId = match.teacher_profile_id
        teacherUserId = match.teacher_user_id ?? null
        chosenSource = "explicit"
      }
    }

    // 2) Иначе/если выбранный уже занят — фолбэк на топ-1 по рейтингу.
    if (!teacherProfileId) {
      const { data: candidates, error: rpcErr } = await admin.rpc(
        "find_trial_teacher",
        {
          p_slot: args.preferredSlot,
          p_duration: TRIAL_DURATION_MIN,
          p_tz: "Europe/Moscow",
        }
      )
      if (rpcErr) {
        console.error("[autoAssignTrial] find_trial_teacher rpc error", rpcErr)
      }
      const candidate = Array.isArray(candidates) ? candidates[0] : null
      console.log("[autoAssignTrial] find_trial_teacher returned", {
        teacherProfileId: candidate?.teacher_profile_id ?? null,
      })
      if (candidate?.teacher_profile_id) {
        teacherProfileId = candidate.teacher_profile_id
        teacherUserId = candidate.teacher_user_id ?? null
        chosenSource = "fallback"
      }
    }

    if (teacherProfileId) {
      // Insert lesson (status='booked', free trial — price=0).
      const { data: lesson, error: lessonErr } = await admin
        .from("lessons")
        .insert({
          student_id: userId,
          teacher_id: teacherProfileId,
          scheduled_at: args.preferredSlot,
          duration_minutes: TRIAL_DURATION_MIN,
          status: "booked",
          price: 0,
          jitsi_room_name: null,
          teacher_notes: "Пробный урок (auto-assign)",
        })
        .select("id")
        .single()

      if (!lessonErr && lesson?.id) {
        lessonId = lesson.id
        teacherProfileIdAssigned = teacherProfileId
        await admin
          .from("lessons")
          .update({ jitsi_room_name: `speakflow-${lesson.id}` })
          .eq("id", lesson.id)

        // ВАЖНО: assigned_teacher_id FK → teacher_profiles.id (а не profiles.id),
        // status разрешён в check как 'scheduled' (мигр 047).
        const { error: updErr } = await admin
          .from("trial_lesson_requests")
          .update({
            status: "scheduled",
            assigned_teacher_id: teacherProfileId,
            assigned_lesson_id: lesson.id,
          })
          .eq("id", requestId)
        if (updErr) {
          console.error("[autoAssignTrial] trial_request UPDATE failed", {
            message: updErr.message,
            code: (updErr as any)?.code,
            details: (updErr as any)?.details,
            hint: (updErr as any)?.hint,
            requestId,
            lessonId,
            teacherProfileId,
          })
        }
        status = "scheduled"
        console.log("[autoAssignTrial] success", {
          requestId,
          lessonId,
          teacherProfileId,
          teacherUserId,
          chosenSource,
        })
      } else {
        // Полный объект ошибки в лог — увидим точную причину PG-fail'а.
        console.error("[autoAssignTrial] lesson INSERT failed", {
          message: lessonErr?.message,
          code: (lessonErr as any)?.code,
          details: (lessonErr as any)?.details,
          hint: (lessonErr as any)?.hint,
          teacherProfileId,
          studentId: userId,
          scheduled_at: args.preferredSlot,
        })
      }
    } else {
      console.error("[autoAssignTrial] no teacher resolved", {
        requestId,
        explicit: args.teacherProfileId ?? null,
        preferredSlot: args.preferredSlot,
      })
    }
  }

  // 3) Telegram fan-out (fire-and-forget; never block the auth flow).
  void notifyAdmins({
    requestId,
    userId,
    preferredSlot: args.preferredSlot,
    teacherUserId,
    status,
  }).catch(() => {})

  return {
    requestId,
    reused: false,
    status,
    lessonId,
    teacherUserId,
  }
}

async function notifyAdmins(args: {
  requestId: string
  userId: string
  preferredSlot: string | null
  teacherUserId: string | null
  status: string
}) {
  const admin = createAdminClient()

  const [{ data: profile }, { data: admins }, teacherRow] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", args.userId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("telegram_chat_id")
      .eq("role", "admin")
      .not("telegram_chat_id", "is", null),
    args.teacherUserId
      ? admin
          .from("profiles")
          .select("full_name, telegram_chat_id")
          .eq("id", args.teacherUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let slotLine = ""
  if (args.preferredSlot) {
    try {
      const d = new Date(args.preferredSlot)
      const fmt = new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }).format(d)
      slotLine = `🗓 Слот: ${fmt} МСК\n`
    } catch {
      slotLine = `🗓 Слот: ${args.preferredSlot}\n`
    }
  }

  const teacherLine =
    args.status === "scheduled" && teacherRow.data
      ? `👨‍🏫 Назначен: <b>${teacherRow.data.full_name}</b>\n`
      : args.preferredSlot
      ? `⚠️ Свободного преподавателя на слот не нашлось\n`
      : ""

  const adminText =
    `🎙 <b>Новая заявка на пробное занятие</b>\n\n` +
    `<b>${profile?.full_name || "—"}</b>\n` +
    (profile?.email ? `📧 ${profile.email}\n` : "") +
    (profile?.phone ? `📱 ${profile.phone}\n` : "") +
    slotLine +
    teacherLine +
    `\n<code>${args.requestId}</code>`

  const sends: Promise<unknown>[] = []
  for (const a of admins ?? []) {
    if (!a?.telegram_chat_id) continue
    sends.push(
      sendTelegramMessage({
        chatId: a.telegram_chat_id as number,
        text: adminText,
        parseMode: "HTML",
      }).catch(() => {})
    )
  }

  // Notify the assigned teacher too.
  if (
    args.status === "scheduled" &&
    teacherRow.data?.telegram_chat_id
  ) {
    const teacherText =
      `📚 <b>Новый пробный урок</b>\n\n` +
      `Ученик: <b>${profile?.full_name || "—"}</b>\n` +
      (profile?.email ? `📧 ${profile.email}\n` : "") +
      slotLine +
      `Длительность: ${TRIAL_DURATION_MIN} мин\n`
    sends.push(
      sendTelegramMessage({
        chatId: teacherRow.data.telegram_chat_id as number,
        text: teacherText,
        parseMode: "HTML",
      }).catch(() => {})
    )
  }

  await Promise.all(sends)
}
