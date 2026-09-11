// Честное состояние ревью урока для «Истории занятий»: по статусу урока,
// наличию записи, транскрипта и саммари.

export type ReviewState = {
  badge: string
  tone: "ok" | "wait" | "none"
  text: string
}

export type ReviewInput = {
  status: string
  hasSummary: boolean
  recordingStatus: string | null
  transcriptStatus: string | null
}

export function reviewState(i: ReviewInput): ReviewState {
  if (i.hasSummary) return { badge: "Ревью готово", tone: "ok", text: "" }
  if (i.status === "cancelled") return { badge: "Урок отменён", tone: "none", text: "Ревью не будет: урок не состоялся." }
  if (i.status === "no_show") return { badge: "Урок не состоялся", tone: "none", text: "Ревью не будет: на урок не пришли." }
  if (i.status === "booked" || i.status === "pending_payment") {
    return { badge: "Урок не состоялся", tone: "none", text: "Ревью не будет: урок не был проведён." }
  }
  if (i.transcriptStatus === "failed") return { badge: "Ревью нет", tone: "none", text: "Запись урока не удалось расшифровать." }
  if (i.recordingStatus === "finalized" || i.recordingStatus === "recording" || i.transcriptStatus === "ok") {
    return { badge: "Ревью готовится", tone: "wait", text: "Запись урока обрабатывается. Обычно это занимает несколько минут после окончания занятия." }
  }
  return { badge: "Ревью нет", tone: "none", text: "Запись урока не велась, ревью для этого занятия не будет." }
}

export const reviewBadgeClass: Record<ReviewState["tone"], string> = {
  ok: "bg-green-100 text-green-800",
  wait: "bg-amber-100 text-amber-800",
  none: "bg-neutral-100 text-neutral-500",
}

/** Загружает статусы записей и транскриптов по урокам. */
export async function loadReviewSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  lessonIds: string[],
): Promise<{ recordingByLesson: Map<string, string>; transcriptByLesson: Map<string, string> }> {
  const recordingByLesson = new Map<string, string>()
  const transcriptByLesson = new Map<string, string>()
  if (lessonIds.length === 0) return { recordingByLesson, transcriptByLesson }
  const [recRes, trRes] = await Promise.all([
    admin.from("lesson_recordings").select("lesson_id, status").in("lesson_id", lessonIds),
    admin.from("lesson_transcripts").select("lesson_id, status").in("lesson_id", lessonIds),
  ])
  for (const r of (recRes.data ?? []) as Array<{ lesson_id: string; status: string }>) recordingByLesson.set(r.lesson_id, r.status)
  for (const t of (trRes.data ?? []) as Array<{ lesson_id: string; status: string }>) transcriptByLesson.set(t.lesson_id, t.status)
  return { recordingByLesson, transcriptByLesson }
}
