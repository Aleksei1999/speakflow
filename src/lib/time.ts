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

// Extended formatter set — includes the new helpers required for fixing
// hard-coded `locale: ru` usages across the dashboard (clubs week header,
// leaderboard period, profile roast journey, lesson booking modal etc.).
type FormatterSetExt = FormatterSet & {
  weekdayNarrow: Intl.DateTimeFormat
  weekdayShortDayMonthShort: Intl.DateTimeFormat
  dayMonthYearLong: Intl.DateTimeFormat
  dayMonthYearShort: Intl.DateTimeFormat
  monthYearLong: Intl.DateTimeFormat
  monthLong: Intl.DateTimeFormat
  monthShort: Intl.DateTimeFormat
  weekdayLongDayMonthLong: Intl.DateTimeFormat
  weekdayLongDayMonthYearLong: Intl.DateTimeFormat
  dayMonthShort: Intl.DateTimeFormat
  dayMonthLongTime: Intl.DateTimeFormat
  weekdayShortDayMonthLong: Intl.DateTimeFormat
  dayOfMonth: Intl.DateTimeFormat
}

function build(locale: string, hour12: boolean): FormatterSetExt {
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
    weekdayNarrow: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "narrow",
    }),
    // "пн, 18 мая" / "Mon, May 18" — used in upcoming-slot pills.
    weekdayShortDayMonthShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    // "понедельник, 18 мая" / "Monday, May 18" — used in clubs day group title.
    weekdayLongDayMonthLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    // "понедельник, 18 мая 2026 г." / "Monday, May 18, 2026" — booking modal hero.
    weekdayLongDayMonthYearLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    // "17 мая 2026 г." / "May 17, 2026" — clubs week-range end.
    dayMonthYearLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    // "17 мая 26 г." / "May 17, 2026" — fallback short with year.
    dayMonthYearShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    // "май 2026 г." / "May 2026" — leaderboard period header.
    monthYearLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      month: "long",
      year: "numeric",
    }),
    // "май" / "May" — full month name (booking modal "May 2026" composite).
    monthLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      month: "long",
    }),
    // "май" / "May" — short month.
    monthShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      month: "short",
    }),
    // "13 мая" / "May 13" — short day+month.
    dayMonthShort: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "short",
    }),
    // "13 мая, 14:30" / "May 13, 2:30 PM" — long day + time.
    dayMonthLongTime: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12,
    }),
    // "пн, 13 мая" / "Mon, May 13" — short weekday + long day+month.
    weekdayShortDayMonthLong: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      weekday: "short",
      day: "numeric",
      month: "long",
    }),
    // "13" — just day number.
    dayOfMonth: new Intl.DateTimeFormat(locale, {
      timeZone: TZ,
      day: "numeric",
    }),
  }
}

const FORMATTERS: Record<TimeLocale, FormatterSetExt> = {
  ru: build("ru-RU", false),
  en: build("en-US", true),
}

function pickSet(locale?: TimeLocale): FormatterSetExt {
  return FORMATTERS[locale === "en" ? "en" : "ru"]
}

/** Map any string locale value to a strict TimeLocale union. */
export function asTimeLocale(locale?: string | null): TimeLocale {
  return locale === "en" ? "en" : "ru"
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

// ─────────────────────────────────────────────────────────────────────────────
// Extra locale-aware helpers (used to replace hardcoded `locale: ru` calls
// in dashboard surfaces — clubs, leaderboard, profile, booking modals etc.).
// ─────────────────────────────────────────────────────────────────────────────

/** "пн" (ru) / "M" (en) — narrow weekday letter, used in calendar grid. */
export function formatWeekdayNarrow(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayNarrow.format(d)
}

/** "пн, 18 мая" / "Mon, May 18" — short weekday + short date pill. */
export function formatWeekdayShortDayMonthShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayShortDayMonthShort.format(d)
}

/** "понедельник, 18 мая" / "Monday, May 18" — clubs day group title. */
export function formatWeekdayLongDayMonthLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayLongDayMonthLong.format(d)
}

/** "понедельник, 18 мая 2026 г." / "Monday, May 18, 2026" — booking hero. */
export function formatWeekdayLongDayMonthYearLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayLongDayMonthYearLong.format(d)
}

/** "17 мая 2026 г." / "May 17, 2026" — used in clubs week range. */
export function formatDayMonthYearLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayMonthYearLong.format(d)
}

/** "17 мая 26 г." / "May 17, 2026" — short month with year. */
export function formatDayMonthYearShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayMonthYearShort.format(d)
}

/** "май 2026 г." / "May 2026" — leaderboard period header. */
export function formatMonthYearLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).monthYearLong.format(d)
}

/** "май" / "May" — full month name. */
export function formatMonthLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).monthLong.format(d)
}

/** "май" / "May" — short month, no day. */
export function formatMonthShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).monthShort.format(d)
}

/** "13 мая, 14:30" (ru) / "May 13, 2:30 PM" (en). */
export function formatDayMonthLongTime(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayMonthLongTime.format(d)
}

/** "пн, 13 мая" / "Mon, May 13". */
export function formatWeekdayShortDayMonthLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayShortDayMonthLong.format(d)
}

/** Number of day in month — "18". */
export function formatDayOfMonth(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayOfMonth.format(d)
}

/**
 * Format a contiguous week range like
 *  ru: "11 — 17 мая 2026 г."  /  en: "May 11 — 17, 2026".
 *
 * Uses `formatRangeToParts` so months collapse when both ends share one.
 * Safe fallback for older runtimes: `from – to` via the long formatter.
 */
export function formatWeekRange(
  from: Date | string | number,
  to: Date | string | number,
  locale?: TimeLocale
): string {
  const start = from instanceof Date ? from : new Date(from)
  const end = to instanceof Date ? to : new Date(to)
  const set = pickSet(locale)
  // Intl.DateTimeFormat#formatRange exists in all currently-supported runtimes
  // (Node 18+, evergreen browsers). The helper formats both endpoints with the
  // long y/M/d formatter and collapses shared month/year automatically.
  const dtf = set.dayMonthYearLong as Intl.DateTimeFormat & {
    formatRange?: (from: Date, to: Date) => string
  }
  if (typeof dtf.formatRange === "function") {
    return dtf.formatRange(start, end)
  }
  return `${set.dayShort.format(start)} – ${set.dayMonthYearLong.format(end)}`
}
