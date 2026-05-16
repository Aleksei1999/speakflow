// ---------------------------------------------------------------------------
// next-intl request config — runs on every server-rendered route.
//
// We DON'T use locale URL prefixing — locale comes from the cookie
// `rwen_locale` (set by the settings page when the user changes
// language, or by /api/auth/callback after login from profiles.language).
//
// On the server we never directly read profile.language inside the
// next-intl request config (cookies() is the only stable per-request
// signal accessible from getRequestConfig). The settings PATCH writes
// both the cookie AND profiles.language → they stay in sync.
// ---------------------------------------------------------------------------
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

import { asLocale, defaultLocale, LOCALE_COOKIE } from './config'

export default getRequestConfig(async () => {
  const store = await cookies()
  const fromCookie = store.get(LOCALE_COOKIE)?.value
  const locale = asLocale(fromCookie, defaultLocale)

  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
    timeZone: 'Europe/Moscow',
    now: new Date(),
  }
})
