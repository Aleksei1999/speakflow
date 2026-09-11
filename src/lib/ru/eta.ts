import { pluralize } from "@/lib/ru/plural"

/**
 * «через N мин / N ч / N дн.» — для подсказок «комната откроется…».
 * < 60 мин → минуты, < 48 ч → часы, дальше — дни.
 */
export function formatEta(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes))
  if (m < 60) return `через ~${m} ${pluralize(m, "минуту", "минуты", "минут")}`
  const h = Math.round(m / 60)
  if (h < 48) return `через ~${h} ч`
  const d = Math.round(h / 24)
  return `через ~${d} дн.`
}
