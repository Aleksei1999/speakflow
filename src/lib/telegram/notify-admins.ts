import { createAdminClient } from "@/lib/supabase/admin"
import { sendTelegramMessage } from "@/lib/telegram/bot"

/** Telegram-сообщение всем админам с привязанным чатом. Ошибки не пробрасываются. */
export async function notifyAdminsTelegram(text: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from("profiles").select("telegram_chat_id").eq("role", "admin").not("telegram_chat_id", "is", null)
    await Promise.all(
      ((data ?? []) as Array<{ telegram_chat_id: string | null }>)
        .map((r) => r.telegram_chat_id)
        .filter((id): id is string => !!id)
        .map((chatId) => sendTelegramMessage({ chatId, text })),
    )
  } catch (e) {
    console.warn("[notify-admins]", e)
  }
}

/** Telegram-сообщение одному пользователю, если у него привязан чат. */
export async function notifyUserTelegram(userId: string, text: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from("profiles").select("telegram_chat_id").eq("id", userId).maybeSingle<{ telegram_chat_id: string | null }>()
    if (data?.telegram_chat_id) await sendTelegramMessage({ chatId: data.telegram_chat_id, text })
  } catch (e) {
    console.warn("[notify-user]", e)
  }
}
