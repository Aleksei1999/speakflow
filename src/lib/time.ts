/**
 * TZ-aware форматирование времени уроков. / TZ-aware lesson date formatting.
 *
 * Важно: lessons.scheduled_at в Postgres — timestamptz (UTC).
 * В клиентских компонентах date-fns `format(new Date(iso), "HH:mm")`
 * корректно показывает локальное время браузера (Москва).
 * Но в Server Components на Vercel (TZ=UTC) тот же format вернёт UTC-время,
 * что давало расхождение на -3 часа между /student/schedule (client)
 * и /student (server).
 *
 * Эти утилиты всегда форматируют в Asia/Moscow, одинаково на сервере и клиенте.
 * Locale ('ru' | 'en') — необязательный параметр; по умолчанию 'ru'.
 *
 * Time format differences:
 *  - 'ru' → 24h: "14:30",   "23 апр",  "23 апреля",  "23 апр., 14:30"
 *  - 'en' → 12h: "2:30 PM", "Apr 23",  "April 23",   "Apr 23, 2:30 PM"
 *
 * TZ stays Europe/Moscow for both locales — our users are in Russia.
 */

const TZ = "Europe/Moscow"

export type TimeLocale = "ru" | "en"

// Pre-built formatters per locale — cached on the module scope.
// Intl.DateTimeFormat is expensive to construct; re-use across renders.
type FormatterSet = {
  hhmm: Intl.DateTimeFormat
  dayShort: Intl.DateTimeFormat
  dayLong: Intl.DateTimeFormat
  dateTimeShort: Intl.DateTimeFormat
  weekdayShort: Intl.DateTimeFormat
  weekdayLong: Intl.DateTimeFormat
}

function build(locale: string, hour12: boolean): FormatterSet {
  return {
    hhmm: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12,
    }),
    dayShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
    }),
    dayLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "long",
    }),
    dateTimeShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12,
    }),
    weekdayShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "short",
    }),
    weekdayLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "long",
    }),
  }
}

const FORMATTERS: Record<TimeLocale, FormatterSet> = {
  ru: build("ru-RU", false),
  en: build("en-US", true),
}

function pickSet(locale?: TimeLocale): FormatterSet {
  return FORMATTERS[locale === "en" ? "en" : "ru"]
}

/**
 * "14:30" (ru, 24h) / "2:30 PM" (en, 12h) в Asia/Moscow.
 */
export function formatLessonTime(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).hhmm.format(d)
}

/** "23 апр" (ru) / "Apr 23" (en) в Asia/Moscow. */
export function formatLessonDayShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayShort.format(d)
}

/** "23 апреля" (ru) / "April 23" (en) в Asia/Moscow. */
export function formatLessonDayLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayLong.format(d)
}

/** "23 апр., 14:30" (ru) / "Apr 23, 2:30 PM" (en) в Asia/Moscow. */
export function formatLessonDateTimeShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dateTimeShort.format(d)
}

/** "пн" (ru) / "Mon" (en). */
export function formatWeekdayShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayShort.format(d)
}

/** "понедельник" (ru) / "Monday" (en). */
export function formatWeekdayLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayLong.format(d)
}

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** YYYY-MM-DD ключ в Asia/Moscow (для группировки уроков по дням). */
export function moscowDateKey(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input)
  return isoDayFormatter.format(d) // "2026-04-23"
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
