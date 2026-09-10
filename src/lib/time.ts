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

/** "23 апреля" (ru) / "April 23" (en) в Asia/Moscow. */
export function formatLessonDayLong(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).dayLong.format(d)
}
// ─────────────────────────────────────────────────────────────────────────────
// Extra locale-aware helpers (used to replace hardcoded `locale: ru` calls
// in dashboard surfaces — clubs, leaderboard, profile, booking modals etc.).
// ─────────────────────────────────────────────────────────────────────────────

/** "пн, 18 мая" / "Mon, May 18" — short weekday + short date pill. */
export function formatWeekdayShortDayMonthShort(
  input: Date | string | number,
  locale?: TimeLocale
): string {
  const d = input instanceof Date ? input : new Date(input)
  return pickSet(locale).weekdayShortDayMonthShort.format(d)
}

