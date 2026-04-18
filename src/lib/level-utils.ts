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
