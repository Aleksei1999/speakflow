/** Носитель: преподаёт на английском и не указал русский среди языков. */
export function isNativeHeuristic(languages: string[] | null | undefined): boolean {
  if (!languages || languages.length === 0) return false
  const hasEn = languages.some((l) => l.toLowerCase() === 'en')
  const hasRu = languages.some((l) => l.toLowerCase() === 'ru')
  return hasEn && !hasRu
}
