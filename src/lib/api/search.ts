/** Поисковая строка для PostgREST-фильтров (.or/.ilike): убираем символы, ломающие грамматику фильтра. */
export function sanitizeSearch(raw: string | null | undefined, max = 100): string {
  return (raw ?? '')
    .replace(/[,()"'\\%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
