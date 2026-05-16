// ---------------------------------------------------------------------------
// Server-side locale helpers. Use these inside server components, server
// actions, and route handlers when you need to know the active UI locale
// outside of next-intl's `getRequestConfig` (e.g., to pick a localised
// email template or to pass `locale` to formatLessonTime).
// ---------------------------------------------------------------------------
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
