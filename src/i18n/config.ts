// ---------------------------------------------------------------------------
// i18n config — single-locale runtime via next-intl.
//
// Site is rendered at a single URL tree (no /en/... prefix). Locale is
// resolved per-request from (in order):
//   1. profile.language (cookie `rwen_locale` mirrors it for guests / SSR)
//   2. cookie `rwen_locale`
//   3. default 'ru'
//
// Date / time formatting always uses Europe/Moscow timezone — our users
// are based in Russia regardless of UI language.
// ---------------------------------------------------------------------------

export const locales = ['ru', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ru'

/** Cookie key used to persist the user-selected locale. */
export const LOCALE_COOKIE = 'rwen_locale'

/** Cookie max age — 1 year. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(v: unknown): v is Locale {
  return v === 'ru' || v === 'en'
}

export function asLocale(v: unknown, fallback: Locale = defaultLocale): Locale {
  return isLocale(v) ? v : fallback
}
