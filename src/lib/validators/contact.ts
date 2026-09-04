// ---------------------------------------------------------------------------
// Общая валидация телефона и email — используется во всех user-formах.
// Строгий RU-формат телефона: +7 / 8 / 7 префиксы, нормализуется в +7XXXXXXXXXX.
// Email — RFC-ish + не-мусорный (min 3 chars local, valid domain shape).
// ---------------------------------------------------------------------------

import { z } from 'zod'

/**
 * Нормализация RU-номера. Принимает свободный ввод (`+7 (999) 123-45-67`,
 * `89991234567`, `7 999 123 45 67`), возвращает `+7XXXXXXXXXX` или null.
 */
export function normalizePhoneRu(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D+/g, '')
  if (digits.length < 10) return null
  let clean = digits
  if (clean.length === 11 && (clean.startsWith('8') || clean.startsWith('7'))) {
    clean = '7' + clean.slice(1)
  } else if (clean.length === 10) {
    clean = '7' + clean
  }
  if (clean.length !== 11 || !clean.startsWith('7')) return null
  // RU mobile codes: начинаются с 9. Если не с 9 — пропускаем (можно быть городской).
  return `+${clean}`
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

/** Zod-schema для телефона (нормализует в +7XXXXXXXXXX или throws). */
export const phoneRuSchema = z
  .string()
  .trim()
  .min(1, 'Введите номер телефона')
  .transform((v, ctx) => {
    const normalized = normalizePhoneRu(v)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный номер телефона' })
      return z.NEVER
    }
    return normalized
  })

/**
 * Международный вариант — принимает 10..15 цифр (E.164-ish), возвращает
 * `+<digits>`. Используется на лендинге где юзер может выбрать любую страну.
 */
export function normalizePhoneIntl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D+/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return `+${digits}`
}

export const phoneIntlSchema = z
  .string()
  .trim()
  .min(1, 'Введите номер телефона')
  .transform((v, ctx) => {
    const normalized = normalizePhoneIntl(v)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Некорректный номер телефона' })
      return z.NEVER
    }
    return normalized
  })

/** Zod-schema для email. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Введите email')
  .max(254, 'Email слишком длинный')
  .refine((v) => isValidEmail(v), { message: 'Некорректный email' })
