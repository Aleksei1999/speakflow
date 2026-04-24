/**
 * Расширенные email-шаблоны Raw English (визуальная система 2026-04).
 *
 * Тёмно-минималистичный бренд-стиль: карточка 560px, шрифт Inter,
 * #F5F5F3 фон, #0A0A0A текст, акцент #E63946 (Raw English red).
 *
 * Все шаблоны используют inline-стили (email-клиенты чистят <style>).
 * SVG-лого Raw English инлайнится в шапке каждого письма.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://raw-english.com'

// Inline SVG-логотип Raw English (фирменный, чёрный вариант + красный акцент).
// Ширина 120px, высота автоматически — cls-1 (чёрный) + cls-2 (красный #CC3A3A).
const RAW_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330.29 188.56" width="120" style="display:block;"><defs><style>.rcls-1{fill:#1E1E1E;}.rcls-2{fill:#CC3A3A;}</style></defs><g><path class="rcls-1" d="M148.91,179.62a18.32,18.32,0,0,1-7-1.22,9.48,9.48,0,0,1-4.55-3.77,12.08,12.08,0,0,1-1.6-6.51,14.16,14.16,0,0,1,1.09-5.74,11.48,11.48,0,0,1,3-4.11,12.94,12.94,0,0,1,4.43-2.48,17.16,17.16,0,0,1,5.37-.83,16.15,16.15,0,0,1,3.68.41,9.94,9.94,0,0,1,3.09,1.26,6.28,6.28,0,0,1,2.12,2.17,6,6,0,0,1,.77,3.14,5.09,5.09,0,0,1-3,5,12.51,12.51,0,0,1-3.2,1c-1.19.21-2.43.38-3.73.49-.65.11-1.43.2-2.32.27s-1.76.13-2.6.17-1.49.06-2,.06a1.86,1.86,0,0,0-1,.19.83.83,0,0,0-.26.7,3.75,3.75,0,0,0,.33,1.4,6.7,6.7,0,0,0,1,1.57,5.56,5.56,0,0,0,2.67,1.88,13,13,0,0,0,3.75.47,12.59,12.59,0,0,0,3.54-.47c1.06-.31,2-.62,2.89-.93a6.69,6.69,0,0,1,2.32-.47,2.68,2.68,0,0,1,1.47.35,1.48,1.48,0,0,1,.54,1.35,2.48,2.48,0,0,1-.82,1.75,7.18,7.18,0,0,1-2.29,1.47,16,16,0,0,1-3.43,1A22.76,22.76,0,0,1,148.91,179.62Z"/><path class="rcls-2" d="M199.36,87.38c.17,2.56.36,5.12.51,7.68a147.16,147.16,0,0,1-1.7,33.22c-.83,4.77-2.24,9.42-6,12.81-6.86,6.14-14.6,6.38-22.79,3.2a13.91,13.91,0,0,1-2.78-1.46c-4.83-3.25-10-3.68-15.59-2.44-6.67,1.5-13.39,2.73-20.28,1.91-6-.71-11.59-2.55-16.35-6.47a22.38,22.38,0,0,1-2.18-33.06c6.94-7.49,16-11,25.44-13.94,5.17-1.59,10.31-3.31,15.35-5.28,2.39-.94,5.13-2.34,4.54-5.62s-3.61-3.71-6.33-4c-5.56-.69-10.19,1.83-14.75,4.51-2.93,1.73-5.8,3.59-8.82,5.14a12.94,12.94,0,0,1-9.19,1.1,6.42,6.42,0,0,1-5.19-6.89c.11-5,3.14-8.49,6.39-11.66,16-15.67,41.24-19.47,61-9.05,4.27,2.26,8,5.54,12.38,8.62-.12-1.52.11-3.11-.4-4.41-2.09-5.39.85-12.18,8.76-13.74,9.41-1.86,20.27,3.07,21.23,15.11.23,2.88.5,5.75.84,8.61a35.77,35.77,0,0,0,.94,5.16c.66,2.43,1.15,5.15,4.3,5.63,2.16.32,4.09-1.66,5.27-5.37.79-2.5,1.33-5.08,2-7.6,2.09-7.49,6.46-11.37,13.24-11.83,7.87-.53,14.41,3.07,17.17,9.9,1.44,3.55,2.15,7.38,3.28,11a48.08,48.08,0,0,0,2.46,6.88c1,2.1,2.65,3.89,5.25,3.75a5.31,5.31,0,0,0,4.92-4.14c1.26-5.15,2.13-10.4,3.08-15.62.47-2.57.55-5.24,1.23-7.75a12.26,12.26,0,0,1,9.21-9.15,5.49,5.49,0,0,0,3.95-3.31c4.38-9.32,19.5-11.9,26.91-4.72,4.69,4.54,5,12.66-.17,17.15-4.1,3.52-4.81,7.11-4.64,12.23.23,6.47-.81,13.07-2,19.49-1.54,8.51-3.65,16.92-5.67,25.33a58.58,58.58,0,0,1-2.82,8.45,19.49,19.49,0,0,1-15.87,12.6,41,41,0,0,1-25.72-4.21c-6.6-3.44-10.2-9.33-12.68-16.1a37.76,37.76,0,0,0-3-6.69c-2.2-3.65-5.63-4.18-8.46-1-2.07,2.35-4.13,5.27-4.75,8.24-2.39,11.44-14.53,13.47-22.39,8.77-6.95-4.16-10.17-10.89-12.37-18.22-2-6.53-3.57-13.16-5.36-19.74-.29-1.06-.7-2.09-1.06-3.13Zm-39.47,15.51c0-2.9-.82-4-3.5-3.56-7.4,1.14-13.89,4.18-18.54,10.26-2.38,3.11-2.53,6.63-.6,9,2.23,2.76,5.31,3.15,8.57,2.41C153.66,119.24,159.87,111.2,159.89,102.89Z"/><path class="rcls-2" d="M85.48,80.43c10.83,5.94,14.59,15.31,15.13,26.57.33,6.71.21,13.57,1.67,20,2.09,9.21,8.32,15.37,17.46,18.3a14.63,14.63,0,0,1,1.73.58c3.83,1.75,4.54,5.31,1.44,8.16-4.39,4-9.78,6.11-15.55,7.07C90.15,164,76,154.35,71.29,135.3c-1.85-7.5-2.14-15.38-3.22-23.08-.6-4.23-1.25-8.47-2.13-12.65-.51-2.41-1.47-5.11-4.38-5.25s-3.84,2.69-4.67,5c-2.59,7.14-3.61,14.54-1.48,21.91,3.31,11.44-2.26,19.09-12.36,22.38-10.34,3.37-20.18,1.93-28.66-5.08-7.85-6.5-9.65-15.52-9-25.16.72-11.46,4.75-22.18,7.73-33.14q3-10.86,5.23-21.9c1-4.56-.34-8.4-4.17-11.64-6.87-5.83-5.65-14,2.38-18,1.64-.83,3.3-1.61,4.93-2.44A11.44,11.44,0,0,0,28,17C29.62,4.73,42.18-.34,53.36,6.08a8.17,8.17,0,0,1,2.35,1.66c2.37,2.94,4.75,2.2,7.72.76C74.82,3,86.77-.48,99.58.05c10.16.42,19.79,2.54,27.55,9.77,6,5.55,8,12.56,7.22,20.47-1.09,10.6-6.57,19.05-13.63,26.6-9.3,10-20.89,16.59-33,22.48C87.14,79.67,86.53,79.94,85.48,80.43Zm-25-12.36A73.48,73.48,0,0,0,80.67,54.23a42.91,42.91,0,0,0,7.71-9.83c3.56-6.61.36-12.36-7-13.32a26.27,26.27,0,0,0-14.08,2.24,3.17,3.17,0,0,0-1.3,2.2c-1.07,7-2,14-3.06,21C62.29,60.25,61.38,64,60.52,68.07Z"/><path class="rcls-2" d="M7.73,24.4a23.69,23.69,0,0,1-3.67-.84c-3.9-1.43-5.18-5.4-3-9C3.89,10,11.39,7.33,16.53,9.09c4.18,1.44,5.51,5.43,2.91,9.28S13.08,24.2,7.73,24.4Z"/><path class="rcls-2" d="M288.22,46.36c-2.81-.26-5.32-.69-6.24-3.43s.64-4.72,2.66-6.29c3-2.32,6.35-3.66,10.22-2.6s5.08,4.19,2.72,7.42A12,12,0,0,1,288.22,46.36Z"/></g></svg>`

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Базовый layout для всех новых email-шаблонов Raw English.
 *
 * @param title      — заголовок документа (<title>)
 * @param category   — категория в правом верхнем углу (НАПОМИНАНИЕ/ДОСТИЖЕНИЕ/ПРОМО/...)
 * @param heading    — крупный заголовок письма
 * @param name       — имя получателя
 * @param bodyHtml   — уже-собранный HTML тела письма (абзацы, списки, инфоблоки)
 * @param ctaLabel   — текст кнопки
 * @param ctaUrl     — ссылка кнопки
 * @param noteHtml   — опциональный info/warning-блок под кнопкой (может быть пустой строкой)
 */
function layoutV2(params: {
  title: string
  category: string
  heading: string
  name: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  noteHtml?: string
}): string {
  const { title, category, heading, name, bodyHtml, ctaLabel, ctaUrl, noteHtml } = params
  const noteBlock = noteHtml && noteHtml.length > 0 ? noteHtml : ''

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F3;font-family:'Inter',Arial,Helvetica,sans-serif;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:#F5F5F3;padding:32px 16px;">
  <tr><td align="center">
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="560" style="max-width:560px;background:#FFFFFF;border-radius:18px;border:1px solid #EEEEEA;overflow:hidden;">
      <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #EEEEEA;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr>
          <td align="left" valign="middle">${RAW_LOGO_SVG}</td>
          <td align="right" valign="middle" style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:#8A8A86;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${escapeHtml(category)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:36px 32px 28px;font-family:'Inter',Arial,sans-serif;color:#0A0A0A;">
        <h1 style="margin:0 0 18px;font-size:28px;font-weight:800;letter-spacing:-0.8px;line-height:1.2;color:#0A0A0A;">${escapeHtml(heading)}</h1>
        <div style="font-size:15px;line-height:1.65;color:#0A0A0A;"><p style="margin:0 0 14px;">Привет, ${escapeHtml(name)}!</p>${bodyHtml}</div>
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;"><tr><td align="center" bgcolor="#0A0A0A" style="border-radius:999px;">
          <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
        </td></tr></table>
        ${noteBlock}
      </td></tr>
      <tr><td style="padding:24px 32px 28px;border-top:1px solid #EEEEEA;background:#FAFAF7;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#8A8A86;line-height:1.6;">
        <p style="margin:0 0 6px;">Это письмо отправлено автоматически. Отвечать на него не нужно.</p>
        <p style="margin:0;">&copy; 2026 Raw English &middot; <a href="https://raw-english.com/" style="color:#0A0A0A;text-decoration:none;border-bottom:1px solid #EEEEEA;">raw-english.com</a> &middot; <a href="https://raw-english.com/help" style="color:#0A0A0A;text-decoration:none;border-bottom:1px solid #EEEEEA;">Помощь</a> &middot; <a href="https://raw-english.com/student/settings" style="color:#0A0A0A;text-decoration:none;border-bottom:1px solid #EEEEEA;">Настроить уведомления</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** Info/warning-блок под CTA (левый акцент #E63946). */
function noteBlock(text: string): string {
  return `<div style="padding:14px 16px;background:#FAFAF7;border-left:3px solid #E63946;border-radius:6px;font-size:13px;color:#8A8A86;line-height:1.55;">${text}</div>`
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

// ----- 1. Daily Challenge --------------------------------------------------

export function dailyChallengeEmail(
  name: string,
  challengeTitle: string,
  xpReward: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = 'Ежедневный челлендж ждёт тебя 🎯'
  const bodyHtml = `
    <p style="margin:0 0 14px;">Каждый день — плюс одно маленькое усилие, и через месяц ты не узнаешь свой английский.</p>
    <p style="margin:0 0 14px;">Сегодняшний челлендж:</p>
    <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0A0A0A;">${escapeHtml(challengeTitle)}</p>
    <p style="margin:0 0 14px;">Награда за выполнение: <b>+${xpReward} XP</b>.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Челлендж',
    heading: 'Новый челлендж',
    name,
    bodyHtml,
    ctaLabel: 'Принять челлендж',
    ctaUrl,
    noteHtml: noteBlock('Челлендж доступен до конца дня по Москве. Не забудь отметить выполнение в личном кабинете.'),
  })
  return { subject, html }
}

// ----- 2. Streak warning ---------------------------------------------------

export function streakWarningEmail(
  name: string,
  streakDays: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = '⚠️ Твой streak под угрозой!'
  const bodyHtml = `
    <p style="margin:0 0 14px;">У тебя серия из <b>${streakDays} ${pluralDays(streakDays)}</b> подряд — не дай ей оборваться!</p>
    <p style="margin:0 0 14px;">Всего 10 минут — урок, клуб или мини-челлендж — и streak продолжается.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Напоминание',
    heading: `Не теряй серию: ${streakDays} ${pluralDays(streakDays)}`,
    name,
    bodyHtml,
    ctaLabel: 'Продолжить серию',
    ctaUrl,
    noteHtml: noteBlock('Серия сбрасывается в полночь по МСК. Сделай короткое задание, чтобы сохранить прогресс.'),
  })
  return { subject, html }
}

// ----- 3. New Speaking Club ------------------------------------------------

export function newClubEmail(
  name: string,
  clubTitle: string,
  whenStr: string,
  host: string,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = `Новый Speaking Club: ${clubTitle}`
  const bodyHtml = `
    <p style="margin:0 0 14px;">Открылся новый клуб — свободная практика английского с носителями и другими студентами.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 14px;background:#FAFAF7;border-radius:10px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:17px;font-weight:700;color:#0A0A0A;">${escapeHtml(clubTitle)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#8A8A86;">Когда: <span style="color:#0A0A0A;font-weight:600;">${escapeHtml(whenStr)}</span></p>
        <p style="margin:0;font-size:13px;color:#8A8A86;">Ведущий: <span style="color:#0A0A0A;font-weight:600;">${escapeHtml(host)}</span></p>
      </td></tr>
    </table>
    <p style="margin:0 0 14px;">Места ограничены — успей зарегистрироваться.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Клуб',
    heading: 'Новый Speaking Club',
    name,
    bodyHtml,
    ctaLabel: 'Зарегистрироваться',
    ctaUrl,
  })
  return { subject, html }
}

// ----- 4. Achievement unlocked ---------------------------------------------

export function achievementUnlockedEmail(
  name: string,
  title: string,
  description: string,
  icon: string,
  xpReward: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = `🏆 Ачивка: ${title}`
  const bodyHtml = `
    <p style="margin:0 0 18px;">Ты разблокировал новое достижение:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;background:#FAFAF7;border-radius:10px;">
      <tr>
        <td valign="middle" style="padding:20px 18px;width:72px;font-size:40px;line-height:1;text-align:center;">${escapeHtml(icon)}</td>
        <td valign="middle" style="padding:20px 18px 20px 0;">
          <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#0A0A0A;">${escapeHtml(title)}</p>
          <p style="margin:0;font-size:14px;color:#8A8A86;line-height:1.5;">${escapeHtml(description)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 14px;">Начислено: <b>+${xpReward} XP</b>. Так держать!</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Достижение',
    heading: 'Новая ачивка!',
    name,
    bodyHtml,
    ctaLabel: 'Посмотреть все ачивки',
    ctaUrl,
  })
  return { subject, html }
}

// ----- 5. Level up ---------------------------------------------------------

export function levelUpEmail(
  name: string,
  newLevel: number,
  levelTitle: string,
  totalXp: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = `Level Up! Теперь ты на уровне ${newLevel}`
  const bodyHtml = `
    <p style="margin:0 0 18px;">Поздравляем — ты вышел на новый уровень!</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;background:#FAFAF7;border-radius:10px;">
      <tr><td style="padding:18px 20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#8A8A86;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Уровень ${newLevel}</p>
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0A0A0A;letter-spacing:-0.5px;">${escapeHtml(levelTitle)}</p>
        <p style="margin:0;font-size:14px;color:#8A8A86;">Всего XP: <span style="color:#0A0A0A;font-weight:700;">${totalXp.toLocaleString('ru-RU')}</span></p>
      </td></tr>
    </table>
    <p style="margin:0 0 14px;">Новый уровень открывает новые ачивки, челленджи и бонусы в магазине наград.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Level Up',
    heading: `Уровень ${newLevel}`,
    name,
    bodyHtml,
    ctaLabel: 'Посмотреть прогресс',
    ctaUrl,
  })
  return { subject, html }
}

// ----- 6. Leaderboard overtaken --------------------------------------------

export function leaderboardOvertakenEmail(
  name: string,
  overtakenBy: string,
  newRank: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = 'Тебя обогнали в лидерборде'
  const bodyHtml = `
    <p style="margin:0 0 14px;"><b>${escapeHtml(overtakenBy)}</b> только что обошёл тебя в лидерборде.</p>
    <p style="margin:0 0 14px;">Твоя текущая позиция: <b>#${newRank}</b>.</p>
    <p style="margin:0 0 14px;">Один урок, пара челленджей или выступление в клубе — и ты снова впереди.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Лидерборд',
    heading: 'Тебя обогнали',
    name,
    bodyHtml,
    ctaLabel: 'Вернуть позицию',
    ctaUrl,
    noteHtml: noteBlock('Лидерборд обновляется в реальном времени. Получай XP за уроки, домашку и активность в клубах.'),
  })
  return { subject, html }
}

// ----- 7. Weekly digest ----------------------------------------------------

export function weeklyDigestEmail(
  name: string,
  weekXp: number,
  lessonsAttended: number,
  topAchievement: string,
  streakDays: number,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = 'Твои итоги недели в Raw English'
  const bodyHtml = `
    <p style="margin:0 0 18px;">Вот как прошла твоя неделя:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;background:#FAFAF7;border-radius:10px;">
      <tr><td style="padding:14px 18px;border-bottom:1px solid #EEEEEA;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="font-size:13px;color:#8A8A86;">XP за неделю</td>
          <td align="right" style="font-size:15px;font-weight:700;color:#0A0A0A;">+${weekXp.toLocaleString('ru-RU')}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #EEEEEA;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="font-size:13px;color:#8A8A86;">Уроков пройдено</td>
          <td align="right" style="font-size:15px;font-weight:700;color:#0A0A0A;">${lessonsAttended}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 18px;border-bottom:1px solid #EEEEEA;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="font-size:13px;color:#8A8A86;">Серия</td>
          <td align="right" style="font-size:15px;font-weight:700;color:#0A0A0A;">${streakDays} ${pluralDays(streakDays)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="font-size:13px;color:#8A8A86;">Главная ачивка</td>
          <td align="right" style="font-size:15px;font-weight:700;color:#0A0A0A;">${escapeHtml(topAchievement)}</td>
        </tr></table>
      </td></tr>
    </table>
    <p style="margin:0 0 14px;">Держи темп — регулярность важнее интенсивности.</p>
  `
  const html = layoutV2({
    title: subject,
    category: 'Итоги недели',
    heading: 'Неделя в цифрах',
    name,
    bodyHtml,
    ctaLabel: 'Открыть дашборд',
    ctaUrl,
  })
  return { subject, html }
}

// ----- 8. Marketing promo --------------------------------------------------

export function marketingPromoEmail(
  name: string,
  title: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string
): { subject: string; html: string } {
  const subject = title
  // body — plain text от маркетолога; превращаем переводы строк в абзацы.
  const paragraphs = body
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')
  const bodyHtml = paragraphs || `<p style="margin:0 0 14px;">${escapeHtml(body)}</p>`

  const html = layoutV2({
    title: subject,
    category: 'Промо',
    heading: title,
    name,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    noteHtml: noteBlock('Ты получаешь это письмо, потому что в настройках включены маркетинговые рассылки. Отписаться можно одним кликом.'),
  })
  return { subject, html }
}

// =============================================================================
// TELEGRAM FORMATTERS
// =============================================================================

export function formatTelegramDailyChallenge(
  name: string,
  challengeTitle: string,
  xpReward: number,
  ctaUrl: string
): string {
  return `🎯 <b>Ежедневный челлендж</b>

${name}, сегодня в фокусе:
<b>${challengeTitle}</b>

Награда: <b>+${xpReward} XP</b>

<a href="${ctaUrl}">Принять челлендж</a>`
}

export function formatTelegramStreakWarning(
  name: string,
  streakDays: number,
  ctaUrl: string
): string {
  return `⚠️ <b>Streak под угрозой!</b>

${name}, у тебя серия из <b>${streakDays} ${pluralDays(streakDays)}</b> подряд — не дай ей оборваться.

10 минут практики сегодня — и серия продолжается.

<a href="${ctaUrl}">Продолжить серию</a>`
}

export function formatTelegramNewClub(
  name: string,
  clubTitle: string,
  whenStr: string,
  host: string,
  ctaUrl: string
): string {
  return `🎙 <b>Новый Speaking Club</b>

${name}, открыт новый клуб:
<b>${clubTitle}</b>

Когда: <b>${whenStr}</b>
Ведущий: <b>${host}</b>

<a href="${ctaUrl}">Зарегистрироваться</a>`
}

export function formatTelegramAchievementUnlocked(
  name: string,
  title: string,
  description: string,
  icon: string,
  xpReward: number,
  ctaUrl: string
): string {
  return `🏆 <b>Новая ачивка!</b>

${icon} <b>${title}</b>
${description}

Начислено: <b>+${xpReward} XP</b>

<a href="${ctaUrl}">Посмотреть все ачивки</a>`
}

export function formatTelegramLevelUp(
  name: string,
  newLevel: number,
  levelTitle: string,
  totalXp: number,
  ctaUrl: string
): string {
  return `🚀 <b>Level Up!</b>

${name}, ты вышел на <b>уровень ${newLevel}</b> — ${levelTitle}.
Всего XP: <b>${totalXp.toLocaleString('ru-RU')}</b>

<a href="${ctaUrl}">Посмотреть прогресс</a>`
}

export function formatTelegramLeaderboardOvertaken(
  name: string,
  overtakenBy: string,
  newRank: number,
  ctaUrl: string
): string {
  return `📉 <b>Тебя обогнали в лидерборде</b>

<b>${overtakenBy}</b> обошёл тебя. Твоя позиция сейчас: <b>#${newRank}</b>.

<a href="${ctaUrl}">Вернуть позицию</a>`
}

export function formatTelegramWeeklyDigest(
  name: string,
  weekXp: number,
  lessonsAttended: number,
  topAchievement: string,
  streakDays: number,
  ctaUrl: string
): string {
  return `📊 <b>Итоги недели</b>

${name}, твоя неделя в цифрах:

• XP: <b>+${weekXp.toLocaleString('ru-RU')}</b>
• Уроков: <b>${lessonsAttended}</b>
• Серия: <b>${streakDays} ${pluralDays(streakDays)}</b>
• Главная ачивка: <b>${topAchievement}</b>

<a href="${ctaUrl}">Открыть дашборд</a>`
}

export function formatTelegramMarketingPromo(
  name: string,
  title: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string
): string {
  return `✨ <b>${title}</b>

${body}

<a href="${ctaUrl}">${ctaLabel}</a>`
}

// =============================================================================
// Вспомогательное
// =============================================================================

function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

// Экспортируем APP_URL на случай, если понадобится default-URL в вызовах.
export { APP_URL as RAW_APP_URL }
