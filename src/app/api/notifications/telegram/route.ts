import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, verifyLinkingCode } from '@/lib/telegram/bot'
import { formatTelegramWelcome } from '@/lib/resend/templates'

/**
 * Telegram Bot API Webhook Handler.
 *
 * Обрабатывает входящие обновления от Telegram:
 * - /start <code> — привязка Telegram-аккаунта по коду
 * - /help — справочная информация
 *
 * Telegram отправляет POST-запросы на этот endpoint.
 * Верификация: проверяем секретный токен в заголовке X-Telegram-Bot-Api-Secret-Token.
 */

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

export async function POST(request: NextRequest) {
  // Верификация webhook-секрета
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const message = update.message
  if (!message?.text || !message.from || !message.chat) {
    // Не текстовое сообщение — игнорируем
    return NextResponse.json({ status: 'ok' })
  }

  const chatId = message.chat.id
  const text = message.text.trim()
  const username = message.from.username

  try {
    if (text.startsWith('/start')) {
      await handleStartCommand(chatId, text, username)
    } else if (text === '/help') {
      await handleHelpCommand(chatId)
    } else {
      // Проверяем, не код ли это (6 цифр)
      const codeMatch = text.match(/^\d{6}$/)
      if (codeMatch) {
        await handleLinkingCode(chatId, text, username)
      } else {
        await sendTelegramMessage({
          chatId,
          text: 'Используйте /help для списка доступных команд.',
        })
      }
    }
  } catch (err) {
    console.error('[telegram webhook] Ошибка обработки сообщения:', err)
  }

  // Telegram ожидает быстрый 200 OK
  return NextResponse.json({ status: 'ok' })
}

async function handleStartCommand(chatId: number, text: string, username?: string): Promise<void> {
  // Формат: /start или /start <code>
  const parts = text.split(' ')
  const code = parts[1]?.trim()

  if (code && /^\d{6}$/.test(code)) {
    await handleLinkingCode(chatId, code, username)
  } else {
    await sendTelegramMessage({
      chatId,
      text: `<b>Добро пожаловать в SpeakFlow Bot!</b>

Чтобы привязать ваш Telegram-аккаунт к SpeakFlow:

1. Откройте настройки профиля на сайте SpeakFlow
2. Нажмите «Привязать Telegram»
3. Скопируйте 6-значный код
4. Отправьте его в этот чат

После привязки вы будете получать уведомления о:
- Предстоящих уроках
- Готовых AI-отчётах
- Подтверждениях бронирований
- Платежах

Используйте /help для справки.`,
    })
  }
}

async function handleLinkingCode(chatId: number, code: string, username?: string): Promise<void> {
  const result = await verifyLinkingCode(code, chatId, username)

  if (result) {
    await sendTelegramMessage({
      chatId,
      text: formatTelegramWelcome(result.fullName),
    })
  } else {
    await sendTelegramMessage({
      chatId,
      text: `<b>Код недействителен</b>

Код привязки неверный или истёк. Пожалуйста:

1. Откройте настройки профиля на сайте SpeakFlow
2. Запросите новый код привязки
3. Отправьте его в этот чат

Код действителен 10 минут.`,
    })
  }
}

async function handleHelpCommand(chatId: number): Promise<void> {
  await sendTelegramMessage({
    chatId,
    text: `<b>SpeakFlow Bot — Справка</b>

<b>Доступные команды:</b>
/start — Начать привязку аккаунта
/help — Показать эту справку

<b>Привязка аккаунта:</b>
Отправьте 6-значный код из настроек профиля на сайте SpeakFlow.

<b>Уведомления:</b>
После привязки аккаунта бот автоматически отправляет уведомления о:
- Предстоящих уроках (за 1 час)
- Готовых AI-отчётах по урокам
- Подтверждениях бронирований
- Платежах

<b>Поддержка:</b>
По вопросам обращайтесь на support@speakflow.ru`,
  })
}
