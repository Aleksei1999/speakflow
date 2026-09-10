// i18n: одно URL-дерево без префикса локали; локаль per-request из
// profile.language → cookie `rwen_locale` → 'ru'. Даты всегда в Europe/Moscow —
// пользователи в России независимо от языка UI.

export type Locale = 'ru' | 'en'

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
