// @ts-nocheck
/**
 * Telegram Bot API клиент для SpeakFlow.
 *
 * Используется для отправки уведомлений пользователям, привязавшим
 * Telegram-аккаунт через код подтверждения.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`

// ---------- Отправка сообщений ----------

interface SendMessageOptions {
  chatId: number | string
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableWebPagePreview?: boolean
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = 'HTML',
  disableWebPagePreview = false,
}: SendMessageOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: disableWebPagePreview,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      console.error('[telegram] Ошибка отправки сообщения:', result.description)
      return { success: false, error: result.description }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка Telegram API'
    console.error('[telegram] Исключение при отправке:', message)
    return { success: false, error: message }
  }
}

// ---------- Привязка аккаунта ----------

/**
 * Генерирует 6-значный код привязки Telegram-аккаунта.
 * Код действителен 10 минут. При повторном запросе старый код заменяется.
 */
export async function generateLinkingCode(userId: string): Promise<string> {
  const supabase = createAdminClient()

  // Генерируем 6-значный код
  const code = String(Math.floor(100000 + Math.random() * 900000))

  // Срок действия: 10 минут
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // Удаляем старые неиспользованные коды пользователя
  await supabase
    .from('telegram_linking_codes')
    .delete()
    .eq('user_id', userId)
    .eq('used', false)

  // Создаём новый код
  const { error } = await supabase
    .from('telegram_linking_codes')
    .insert({
      user_id: userId,
      code,
      expires_at: expiresAt,
      used: false,
    })

  if (error) {
    console.error('[telegram] Ошибка генерации кода привязки:', error)
    throw new Error('Не удалось сгенерировать код привязки')
  }

  return code
}

/**
 * Верифицирует код привязки и привязывает Telegram chat_id к профилю.
 * Возвращает userId при успехе, null при ошибке.
 */
export async function verifyLinkingCode(
  code: string,
  chatId: number,
  username?: string
): Promise<{ userId: string; fullName: string } | null> {
  const supabase = createAdminClient()

  // Ищем валидный код
  const { data: linkingCode, error: findError } = await supabase
    .from('telegram_linking_codes')
    .select('id, user_id, expires_at, used')
    .eq('code', code.trim())
    .eq('used', false)
    .single()

  if (findError || !linkingCode) {
    return null
  }

  // Проверяем срок действия
  if (new Date(linkingCode.expires_at) < new Date()) {
    return null
  }

  // Помечаем код как использованный
  await supabase
    .from('telegram_linking_codes')
    .update({ used: true })
    .eq('id', linkingCode.id)

  // Привязываем chat_id к профилю
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
    })
    .eq('id', linkingCode.user_id)

  if (updateError) {
    console.error('[telegram] Ошибка привязки chat_id к профилю:', updateError)
    return null
  }

  // Получаем имя пользователя для приветственного сообщения
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', linkingCode.user_id)
    .single()

  return {
    userId: linkingCode.user_id,
    fullName: profile?.full_name ?? 'Пользователь',
  }
}
