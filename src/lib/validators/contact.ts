// ---------------------------------------------------------------------------
// Общая валидация телефона и email — используется во всех user-формах.
// Телефон: любая страна, парсится libphonenumber-js, хранится в E.164 (+79991234567).
// Email — RFC-ish + не-мусорный (min 3 chars local, valid domain shape).
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

/**
 * Нормализация телефона в E.164. Принимает свободный ввод любой страны
 * (`+7 (999) 123-45-67`, `8 999 123 45 67`, `+1 415 555 2671`).
 * `defaultCountry` (ISO-3166 alpha-2) нужен для номеров без «+» — например
 * «8 999…» для RU. Возвращает `+<digits>` или null, если номер невалиден.
 */
export function normalizePhoneE164(raw: string | null | undefined, defaultCountry?: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const country = defaultCountry && /^[A-Za-z]{2}$/.test(defaultCountry) ? (defaultCountry.toUpperCase() as CountryCode) : undefined
  let parsed
  try {
    parsed = parsePhoneNumberFromString(trimmed, country)
  } catch {
    return null
  }
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

/**
 * Простая email-валидация. RFC-полный regex непрактичен; проверяем базовое:
 * `local@domain.tld`, local ≥1 символа, domain с TLD 2+ букв.
 * Дополнительно можно прогонять через Arcjet (см. validateEmailField в arcjet.ts).
 */
export function isValidEmail(raw: string | null | undefined): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  // Основной шаблон: не-пробельные, @, домен, точка, TLD.
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed)
}
/** Zod-schema для email. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Введите email')
  .max(254, 'Email слишком длинный')
  .refine((v) => isValidEmail(v), { message: 'Некорректный email' })
