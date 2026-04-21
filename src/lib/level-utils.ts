export type RoastLevel = 'Raw' | 'Rare' | 'Medium Rare' | 'Medium' | 'Medium Well' | 'Well Done'

// Back-compat alias — some places may still import EnglishLevel.
export type EnglishLevel = RoastLevel

export const ROAST_LEVELS: RoastLevel[] = ['Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done']

export function calculateLevel(score: number): RoastLevel {
  if (score >= 15) return 'Well Done'
  if (score >= 13) return 'Medium Well'
  if (score >= 10) return 'Medium'
  if (score >= 7) return 'Medium Rare'
  if (score >= 4) return 'Rare'
  return 'Raw'
}

export function getLevelDescription(level: RoastLevel): string {
  const descriptions: Record<RoastLevel, string> = {
    'Raw': 'Понимаю слова, боюсь говорить. Узнаёшь базовые фразы, но стесняешься открыть рот.',
    'Rare': 'Начинаю говорить, много ошибок. Простые диалоги в привычных ситуациях уже получаются.',
    'Medium Rare': 'Общаюсь, но не всегда уверенно. Справляешься с бытовыми темами, иногда не хватает слов.',
    'Medium': 'Свободно поддерживаю беседу. Понимаешь фильмы и статьи, выражаешь своё мнение.',
    'Medium Well': 'Уверенно говорю, чувствую язык. Гибко используешь английский в работе и учёбе.',
    'Well Done': 'Думаю на английском. Понимаешь практически всё, свободно выражаешь любые мысли.',
  }
  return descriptions[level]
}

export function getLevelColor(level: RoastLevel): string {
  const colors: Record<RoastLevel, string> = {
    'Raw': '#CC3A3A',
    'Rare': '#d95050',
    'Medium Rare': '#e06a4a',
    'Medium': '#d4a040',
    'Medium Well': '#b8c060',
    'Well Done': '#DFED8C',
  }
  return colors[level]
}

export function getLevelShortDesc(level: RoastLevel): string {
  const s: Record<RoastLevel, string> = {
    'Raw': 'Понимаю слова, боюсь говорить',
    'Rare': 'Начинаю говорить, много ошибок',
    'Medium Rare': 'Общаюсь, но не всегда уверенно',
    'Medium': 'Свободно поддерживаю беседу',
    'Medium Well': 'Уверенно говорю, чувствую язык',
    'Well Done': 'Думаю на английском',
  }
  return s[level]
}

// XP-пороги из спеки raw-english-xp-map.xlsx (source of truth).
// min — сколько нужно накопить XP чтобы войти в уровень,
// next — порог начала следующего уровня (для progress bar),
// nextLevel — имя следующего уровня, null для Well Done.
export const LEVEL_XP_THRESHOLDS: Record<RoastLevel, { min: number; next: number | null; nextLevel: RoastLevel | null }> = {
  'Raw':         { min: 0,     next: 500,   nextLevel: 'Rare' },
  'Rare':        { min: 500,   next: 2000,  nextLevel: 'Medium Rare' },
  'Medium Rare': { min: 2000,  next: 5000,  nextLevel: 'Medium' },
  'Medium':      { min: 5000,  next: 12000, nextLevel: 'Medium Well' },
  'Medium Well': { min: 12000, next: 25000, nextLevel: 'Well Done' },
  'Well Done':   { min: 25000, next: null,  nextLevel: null },
}

export function xpToRoastLevel(xp: number): RoastLevel {
  if (xp >= 25000) return 'Well Done'
  if (xp >= 12000) return 'Medium Well'
  if (xp >= 5000)  return 'Medium'
  if (xp >= 2000)  return 'Medium Rare'
  if (xp >= 500)   return 'Rare'
  return 'Raw'
}

export function getLevelCEFR(level: RoastLevel): string {
  const map: Record<RoastLevel, string> = {
    'Raw': 'A0-A1',
    'Rare': 'A1-A2',
    'Medium Rare': 'A2-B1',
    'Medium': 'B1-B2',
    'Medium Well': 'B2-C1',
    'Well Done': 'C1+',
  }
  return map[level]
}
