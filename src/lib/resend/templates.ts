/**
 * HTML-шаблоны email-уведомлений Raw English.
 *
 * Все шаблоны используют inline-стили для максимальной совместимости
 * с почтовыми клиентами. Основной цвет бренда: #CC3A3A (RAW English).
 */

const BRAND_COLOR = '#CC3A3A'
const BRAND_COLOR_LIGHT = '#f3e8ea'
const TEXT_COLOR = '#1a1a1a'
const TEXT_SECONDARY = '#666666'
const SUCCESS_COLOR = '#16a34a'
const WARNING_COLOR = '#ea580c'

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Raw English</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;color:${TEXT_SECONDARY};font-size:12px;line-height:1.6;">
                &copy; ${new Date().getFullYear()} Raw English<br>
                Это автоматическое уведомление. Не отвечайте на это письмо.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${BRAND_COLOR};border-radius:8px;padding:14px 28px;">
      <a href="${url}" target="_blank" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${text}</a>
    </td>
  </tr>
</table>`
}

// ---------- Шаблоны ----------

export function welcomeEmail(name: string): { subject: string; html: string } {
  const subject = 'Добро пожаловать в Raw English!'
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:22px;">Привет, ${name}!</h2>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 16px;">
      Рады приветствовать вас на платформе <strong>Raw English</strong>!
    </p>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 16px;">
      Здесь вас ждут:
    </p>
    <ul style="color:${TEXT_COLOR};font-size:15px;line-height:1.9;padding-left:20px;margin:0 0 16px;">
      <li>Индивидуальные занятия с опытными преподавателями</li>
      <li>AI-отчёты после каждого урока с персональными рекомендациями</li>
      <li>Система прогресса и достижений для мотивации</li>
      <li>Удобное расписание и видеозвонки прямо на платформе</li>
    </ul>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 8px;">
      Начните с прохождения теста на определение уровня английского, а затем выберите преподавателя и забронируйте первый урок.
    </p>
    ${button('Начать обучение', `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)}
    <p style="color:${TEXT_SECONDARY};font-size:13px;margin:0;">
      Если у вас возникнут вопросы, мы всегда на связи.
    </p>
  `)
  return { subject, html }
}

export function bookingConfirmationEmail(
  studentName: string,
  teacherName: string,
  date: string,
  time: string,
  duration: number
): { subject: string; html: string } {
  const subject = `Урок подтверждён на ${date}`
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:22px;">Урок забронирован!</h2>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 20px;">
      ${studentName}, ваш урок успешно забронирован. Вот детали:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:${BRAND_COLOR_LIGHT};border-radius:8px;padding:20px;margin:0 0 20px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;width:140px;">Преподаватель</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${teacherName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;">Дата</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;">Время</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${time} (МСК)</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;">Длительность</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${duration} минут</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 8px;">
      Ссылка на видеозвонок будет доступна в личном кабинете за 5 минут до начала урока.
    </p>
    ${button('Перейти к уроку', `${process.env.NEXT_PUBLIC_APP_URL}/student/lessons`)}
    <p style="color:${TEXT_SECONDARY};font-size:13px;margin:0;">
      Для отмены или переноса урока используйте личный кабинет не позднее чем за 12 часов до начала.
    </p>
  `)
  return { subject, html }
}

export function lessonReminderEmail(
  name: string,
  teacherOrStudentName: string,
  date: string,
  time: string,
  joinUrl: string
): { subject: string; html: string } {
  const subject = `Напоминание: урок сегодня в ${time}`
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:22px;">Урок через 1 час!</h2>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 20px;">
      ${name}, напоминаем, что у вас запланирован урок:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:${BRAND_COLOR_LIGHT};border-radius:8px;margin:0 0 20px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;width:100px;">Партнёр</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${teacherOrStudentName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;">Дата</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${TEXT_SECONDARY};font-size:13px;">Время</td>
              <td style="padding:6px 0;color:${TEXT_COLOR};font-size:15px;font-weight:600;">${time} (МСК)</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${button('Присоединиться к уроку', joinUrl)}
    <p style="color:${TEXT_SECONDARY};font-size:13px;margin:0;">
      Подготовьте наушники и проверьте интернет-соединение перед началом урока.
    </p>
  `)
  return { subject, html }
}

export function lessonSummaryReadyEmail(
  studentName: string,
  teacherName: string,
  date: string,
  summaryUrl: string
): { subject: string; html: string } {
  const subject = `AI-отчёт по уроку от ${date} готов`
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:22px;">Отчёт по уроку готов!</h2>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 16px;">
      ${studentName}, преподаватель <strong>${teacherName}</strong> завершил обработку урока от <strong>${date}</strong>,
      и AI-система подготовила подробный отчёт.
    </p>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 16px;">
      В отчёте вы найдёте:
    </p>
    <ul style="color:${TEXT_COLOR};font-size:15px;line-height:1.9;padding-left:20px;margin:0 0 16px;">
      <li>Краткое резюме урока</li>
      <li>Новые слова и выражения с переводом</li>
      <li>Грамматические темы</li>
      <li>Домашнее задание</li>
      <li>Персональные рекомендации</li>
    </ul>
    ${button('Посмотреть отчёт', summaryUrl)}
    <p style="color:${TEXT_SECONDARY};font-size:13px;margin:0;">
      Регулярный просмотр отчётов поможет закрепить пройденный материал.
    </p>
  `)
  return { subject, html }
}

export function paymentReceiptEmail(
  name: string,
  amount: number,
  date: string,
  description: string
): { subject: string; html: string } {
  // amount приходит в копейках, конвертируем в рубли
  const formattedAmount = (amount / 100).toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  })

  const subject = `Квитанция об оплате — ${formattedAmount}`
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:${TEXT_COLOR};font-size:22px;">Оплата получена</h2>
    <p style="color:${TEXT_COLOR};font-size:15px;line-height:1.7;margin:0 0 20px;">
      ${name}, подтверждаем получение вашего платежа.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 20px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding:8px 0;color:${TEXT_SECONDARY};font-size:13px;width:100px;">Сумма</td>
              <td style="padding:8px 0;color:${TEXT_COLOR};font-size:18px;font-weight:700;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:${TEXT_SECONDARY};font-size:13px;">Дата</td>
              <td style="padding:8px 0;color:${TEXT_COLOR};font-size:15px;">${date}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:${TEXT_SECONDARY};font-size:13px;">Описание</td>
              <td style="padding:8px 0;color:${TEXT_COLOR};font-size:15px;">${description}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="color:${SUCCESS_COLOR};font-size:14px;font-weight:600;margin:0 0 16px;">
      &#10003; Платёж успешно обработан
    </p>
    ${button('История платежей', `${process.env.NEXT_PUBLIC_APP_URL}/student/payments`)}
    <p style="color:${TEXT_SECONDARY};font-size:12px;margin:0;">
      Если у вас есть вопросы по платежу, свяжитесь с нашей поддержкой.
    </p>
  `)
  return { subject, html }
}

// ---------- Шаблоны для Telegram-сообщений ----------

export function formatTelegramBookingConfirmation(
  studentName: string,
  teacherName: string,
  date: string,
  time: string,
  duration: number
): string {
  return `<b>Урок забронирован!</b>

${studentName}, ваш урок подтверждён.

<b>Преподаватель:</b> ${teacherName}
<b>Дата:</b> ${date}
<b>Время:</b> ${time} (МСК)
<b>Длительность:</b> ${duration} мин.

Ссылка на видеозвонок появится в личном кабинете за 5 минут до начала.`
}

export function formatTelegramLessonReminder(
  name: string,
  partnerName: string,
  time: string,
  joinUrl: string
): string {
  return `<b>Напоминание: урок через 1 час!</b>

${name}, у вас запланирован урок в <b>${time}</b> (МСК) с <b>${partnerName}</b>.

<a href="${joinUrl}">Присоединиться к уроку</a>

Проверьте наушники и интернет-соединение.`
}

export function formatTelegramSummaryReady(
  studentName: string,
  teacherName: string,
  date: string,
  summaryUrl: string
): string {
  return `<b>AI-отчёт по уроку готов!</b>

${studentName}, преподаватель <b>${teacherName}</b> завершил обработку урока от <b>${date}</b>.

В отчёте: резюме, новые слова, грамматика, домашнее задание и рекомендации.

<a href="${summaryUrl}">Посмотреть отчёт</a>`
}

export function formatTelegramPaymentReceipt(
  name: string,
  amount: number,
  description: string
): string {
  const formattedAmount = (amount / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
  })
  return `<b>Оплата получена</b>

${name}, подтверждаем получение платежа.

<b>Сумма:</b> ${formattedAmount} ₽
<b>Описание:</b> ${description}

&#10003; Платёж успешно обработан`
}

export function formatTelegramWelcome(name: string): string {
  return `<b>Добро пожаловать в Raw English!</b>

${name}, рады видеть вас на платформе RAW English!

Ваш Telegram успешно привязан. Теперь вы будете получать уведомления:
- Напоминания об уроках
- Уведомления о новых AI-отчётах
- Подтверждения бронирований

Хорошего обучения!`
}
