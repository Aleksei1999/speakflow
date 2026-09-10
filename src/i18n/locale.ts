// Server-side локаль вне next-intl getRequestConfig (email-шаблоны, formatLessonTime).
import 'server-only'
import { cookies } from 'next/headers'

import { asLocale, defaultLocale, LOCALE_COOKIE, type Locale } from './config'

/** Reads the rwen_locale cookie (server-only). */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies()
    return asLocale(store.get(LOCALE_COOKIE)?.value, defaultLocale)
  } catch {
    return defaultLocale
  }
}
