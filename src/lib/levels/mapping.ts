// ---------------------------------------------------------------------------
// CEFR ↔ Roast level mapping.
//
// Миграция 011_roast_levels.sql переписала CHECK-констрейнт для колонок
// `user_progress.english_level` и `level_tests.level` с CEFR-нотации
// (A1..C2) на «прожарку» (Raw..Well Done). Весь новый UI/API оперирует
// CEFR (A1..C2) — мапим при записи/чтении, чтобы не мигрировать обратно.
//
// Использование:
//   • ПЕРЕД записью в БД — toRoastLevel('A1') → 'Raw'
//   • ПРИ чтении из БД  — fromRoastLevel('Raw') → 'A1'
// ---------------------------------------------------------------------------

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const ROAST_LEVELS = [
  'Raw',
  'Rare',
  'Medium Rare',
  'Medium',
  'Medium Well',
  'Well Done',
] as const
export type RoastLevel = (typeof ROAST_LEVELS)[number]

const CEFR_TO_ROAST: Record<CefrLevel, RoastLevel> = {
  A1: 'Raw',
  A2: 'Rare',
  B1: 'Medium Rare',
  B2: 'Medium',
  C1: 'Medium Well',
  C2: 'Well Done',
}

const ROAST_TO_CEFR: Record<RoastLevel, CefrLevel> = {
  Raw: 'A1',
  Rare: 'A2',
  'Medium Rare': 'B1',
  Medium: 'B2',
  'Medium Well': 'C1',
  'Well Done': 'C2',
}

/** CEFR (A1..C2) → Roast (Raw..Well Done). Или passthrough если уже roast. */
export function toRoastLevel(cefr: string | null | undefined): RoastLevel {
  if (!cefr) return 'Raw'
  // Если в БД лежит уже roast-значение (Raw/Medium/Well Done ...) — passthrough.
  // Case-insensitive: 'medium' → 'Medium'.
  const trimmed = cefr.trim()
  const roastMatch = (ROAST_LEVELS as readonly string[]).find(
    (r) => r.toLowerCase() === trimmed.toLowerCase(),
  )
  if (roastMatch) return roastMatch as RoastLevel
  // Иначе — трактуем как CEFR.
  const key = trimmed.toUpperCase() as CefrLevel
  return CEFR_TO_ROAST[key] ?? 'Raw'
}

/** Roast (Raw..Well Done) → CEFR (A1..C2). Unknown → 'A1'. */
export function fromRoastLevel(roast: string | null | undefined): CefrLevel {
  if (!roast) return 'A1'
  // На случай если в БД лежит уже CEFR (легаси) — passthrough.
  const upper = roast.toUpperCase()
  if ((CEFR_LEVELS as readonly string[]).includes(upper)) return upper as CefrLevel
  return ROAST_TO_CEFR[roast as RoastLevel] ?? 'A1'
}
