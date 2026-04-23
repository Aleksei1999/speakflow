/**
 * TZ-aware форматирование времени уроков.
 *
 * Важно: lessons.scheduled_at в Postgres — timestamptz (UTC).
 * В клиентских компонентах date-fns `format(new Date(iso), "HH:mm")`
 * корректно показывает локальное время браузера (Москва).
 * Но в Server Components на Vercel (TZ=UTC) тот же format вернёт UTC-время,
 * что давало расхождение на -3 часа между /student/schedule (client)
 * и /student (server).
 *
 * Эти утилиты всегда форматируют в Asia/Moscow, одинаково на сервере и клиенте.
 */

const TZ = "Europe/Moscow"

const hhmmFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const dayShortFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
})

const dayLongFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
})

const dateTimeShortFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/** "19:30" в Asia/Moscow */
export function formatLessonTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  return hhmmFormatter.format(d)
}

/** "23 апр." в Asia/Moscow */
export function formatLessonDayShort(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  return dayShortFormatter.format(d)
}

/** "23 апреля" в Asia/Moscow */
export function formatLessonDayLong(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  return dayLongFormatter.format(d)
}

/** "23 апр., 19:30" в Asia/Moscow */
export function formatLessonDateTimeShort(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  return dateTimeShortFormatter.format(d)
}

/** YYYY-MM-DD ключ в Asia/Moscow (для группировки уроков по дням). */
export function moscowDateKey(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
  return parts // "2026-04-23"
}

/** Проверка "сегодня" в Asia/Moscow. */
export function isMoscowToday(input: Date | string | number, now: Date = new Date()): boolean {
  return moscowDateKey(input) === moscowDateKey(now)
}

/** Проверка "завтра" в Asia/Moscow. */
export function isMoscowTomorrow(input: Date | string | number, now: Date = new Date()): boolean {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return moscowDateKey(input) === moscowDateKey(tomorrow)
}
