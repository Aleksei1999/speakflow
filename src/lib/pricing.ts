/**
 * Single source of truth for Raw English pricing — used by:
 * - /student/balance (top-up tiers + Pro card)
 * - /(marketing) landing PricingSection
 *
 * Если меняешь цены — меняешь здесь, и обе страницы подхватывают.
 */

export type TopupTier = {
  amount: number
  lessons: number
  bonus: string | null
  save: string | null
  perPrice: number
  badge: "default" | "popular" | "best"
  btnLabel: string
  btnVariant: "default" | "red" | "lime"
}

export const TOPUP_TIERS: TopupTier[] = [
  { amount: 5400,  lessons: 3,  bonus: null,                       save: null,                    perPrice: 1800, badge: "default", btnLabel: "Пополнить",   btnVariant: "default" },
  { amount: 9000,  lessons: 6,  bonus: "+1 урок бесплатно",        save: "Экономия 1 800 ₽",      perPrice: 1286, badge: "popular", btnLabel: "Пополнить",   btnVariant: "red"     },
  { amount: 18000, lessons: 13, bonus: "+3 урока бесплатно",       save: "Экономия 5 400 ₽",      perPrice: 1125, badge: "best",    btnLabel: "Лучшая цена", btnVariant: "lime"    },
  { amount: 36000, lessons: 28, bonus: "+8 уроков бесплатно",      save: "Экономия 14 400 ₽",     perPrice: 1000, badge: "default", btnLabel: "Пополнить",   btnVariant: "default" },
]

export const PRO_PRICE_RUB = 1490

export const PRO_FEATURES_YES: string[] = [
  "Уроки 1-on-1 с преподавателями (с баланса)",
  "Тест уровня прожарки",
  "Расширенный профиль",
  "**Speaking Clubs** — безлимитно",
  "**Debate & Wine Clubs**",
  "**Геймификация:** XP, стрики, 6 уровней прожарки",
  "**37 ачивок** с реальными призами (мерч, скидки)",
  "**Лидерборд** — соревнуйся, побеждай, получай подарки",
  "**AI-персонализация** и план обучения",
  "**Персональные видео-уроки** после каждого занятия",
  "**Guest Pass** — приведи друга бесплатно",
  "**Чат коммьюнити** 24/7",
]

export const FREE_FEATURES: Array<{ text: string; yes: boolean }> = [
  { text: "Уроки 1-on-1 с преподавателями (с баланса)", yes: true  },
  { text: "Тест уровня прожарки",                       yes: true  },
  { text: "Базовый профиль",                            yes: true  },
  { text: "Speaking Clubs",                             yes: false },
  { text: "Debate & Wine Clubs",                        yes: false },
  { text: "Геймификация: XP, стрики, уровни",           yes: false },
  { text: "Ачивки и призы",                             yes: false },
  { text: "Лидерборд",                                  yes: false },
  { text: "AI-персонализация и план обучения",          yes: false },
  { text: "Персональные видео-уроки",                   yes: false },
  { text: "Guest Pass для друга",                       yes: false },
  { text: "Чат коммьюнити 24/7",                        yes: false },
]

export function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n)
}

export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}
