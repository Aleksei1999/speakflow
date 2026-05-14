// Fire-and-forget Telegram fan-out when admin assigns a teacher as a club host.
// Notifies the chosen teacher AND every admin (so the action is visible/audited).

import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"

/**
 * Глобальный `Database` (см. `@/types/database`) не описывает таблицу
 * `clubs` и устаревшие PostgREST v12 generics → клиент кастуем к loose
 * виду, а row-формы валидируем явными локальными интерфейсами.
 */
type LooseAdmin = { from: (table: string) => any }

interface ClubRow {
  id: string
  topic: string | null
  starts_at: string | null
  duration_min: number | null
  location: string | null
  format: string | null
  level_min: string | null
  level_max: string | null
}
interface HostProfileRow {
  full_name: string | null
  email: string | null
  telegram_chat_id: number | null
}
interface AdminProfileRow {
  id: string
  telegram_chat_id: number | null
  full_name: string | null
}

export async function notifyClubHostAssigned(args: {
  clubId: string
  hostUserId: string
  assignedByUserId?: string | null
}): Promise<void> {
  const admin = createAdminClient() as unknown as LooseAdmin

  const [clubRes, hostRes, adminsRes] = await Promise.all([
    admin
      .from("clubs")
      .select(
        "id, topic, starts_at, duration_min, location, format, level_min, level_max"
      )
      .eq("id", args.clubId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name, email, telegram_chat_id")
      .eq("id", args.hostUserId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, telegram_chat_id, full_name")
      .eq("role", "admin")
      .not("telegram_chat_id", "is", null),
  ])

  const club = clubRes.data as ClubRow | null
  const hostProfile = hostRes.data as HostProfileRow | null
  const admins = (adminsRes.data ?? []) as AdminProfileRow[]

  if (!club || !hostProfile) return

  let slotLine = ""
  if (club.starts_at) {
    try {
      const d = new Date(club.starts_at)
      const fmt = new Intl.DateTimeFormat("ru-RU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }).format(d)
      slotLine = `🗓 ${fmt} МСК\n`
    } catch {}
  }

  const levelLine =
    club.level_min || club.level_max
      ? `🎯 Уровень: ${club.level_min ?? "—"}${
          club.level_max && club.level_max !== club.level_min
            ? `–${club.level_max}`
            : ""
        }\n`
      : ""

  const sends: Promise<unknown>[] = []

  // 1) Teacher (the chosen speaker).
  if (hostProfile.telegram_chat_id) {
    const teacherText =
      `🎙 <b>Тебя назначили ведущим Speaking Club</b>\n\n` +
      `<b>${club.topic}</b>\n` +
      slotLine +
      `⏱️ ${club.duration_min ?? 60} мин\n` +
      levelLine +
      `\nОткрой раздел Speaking Clubs в личном кабинете.`
    sends.push(
      sendTelegramMessage({
        chatId: hostProfile.telegram_chat_id as number,
        text: teacherText,
        parseMode: "HTML",
      }).catch(() => {})
    )
  }

  // 2) Every admin (audit trail).
  for (const a of admins) {
    if (!a?.telegram_chat_id) continue
    const adminText =
      `✅ <b>Speaking Club назначен ведущему</b>\n\n` +
      `Клуб: <b>${club.topic}</b>\n` +
      `Ведущий: <b>${hostProfile.full_name || hostProfile.email || "—"}</b>\n` +
      slotLine
    sends.push(
      sendTelegramMessage({
        chatId: a.telegram_chat_id as number,
        text: adminText,
        parseMode: "HTML",
      }).catch(() => {})
    )
  }

  await Promise.all(sends)
}
