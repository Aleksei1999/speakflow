import type { Locale } from "@/i18n/config"

/** Локаль из cookie на клиенте (для error-boundary, где нет серверного контекста). */
export function readLocale(): Locale {
  if (typeof document === "undefined") return "ru"
  const m = document.cookie.match(/(?:^|;\s*)rwen_locale=(ru|en)/)
  return (m?.[1] as Locale) ?? "ru"
}
