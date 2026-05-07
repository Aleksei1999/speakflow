/**
 * Превращает «N минут до старта» в читаемую строку с правильной единицей:
 *   < 60 мин   → «5 минут» / «1 минуту» / «42 минуты»
 *   < 24 часов → «3 часа», «2 ч 30 мин»
 *   ≥ 1 суток  → «3 дня 5 ч», «12 дней»
 *
 * Один источник на student/teacher dashboard и /teacher/clubs.
 */

function pluralRu(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}

/**
 * @param totalMinutes — целое число минут до события (отрицательные клампятся в 0).
 */
export function formatTimeUntil(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes))
  if (m < 1) return "меньше минуты"
  if (m < 60) return `${m} ${pluralRu(m, ["минуту", "минуты", "минут"])}`

  const totalH = Math.floor(m / 60)
  const remM = m % 60
  if (totalH < 24) {
    if (remM === 0) return `${totalH} ${pluralRu(totalH, ["час", "часа", "часов"])}`
    return `${totalH} ч ${remM} мин`
  }

  const days = Math.floor(totalH / 24)
  const remH = totalH % 24
  if (remH === 0) return `${days} ${pluralRu(days, ["день", "дня", "дней"])}`
  return `${days} ${pluralRu(days, ["день", "дня", "дней"])} ${remH} ч`
}

export { pluralRu }
