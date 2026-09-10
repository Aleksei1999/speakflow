// next-intl request config. Локаль — только из cookie `rwen_locale` (cookies() —
// единственный стабильный per-request сигнал в getRequestConfig); settings PATCH
// и /api/auth/callback пишут и cookie, и profiles.language, чтобы они не расходились.
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
