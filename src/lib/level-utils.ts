export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export function calculateLevel(score: number): EnglishLevel {
  if (score >= 15) return 'C2'
  if (score >= 13) return 'C1'
  if (score >= 10) return 'B2'
  if (score >= 7) return 'B1'
  if (score >= 4) return 'A2'
  return 'A1'
}

export function getLevelDescription(level: EnglishLevel): string {
  const descriptions: Record<EnglishLevel, string> = {
    A1: 'Начальный уровень. Вы можете понимать и использовать простые повседневные выражения и базовые фразы для удовлетворения конкретных потребностей.',
    A2: 'Элементарный уровень. Вы можете общаться в простых и типичных ситуациях, описывать своё окружение и ближайшие потребности.',
    B1: 'Средний уровень. Вы можете справиться с большинством ситуаций во время путешествий, описывать события и выражать своё мнение.',
    B2: 'Уровень выше среднего. Вы можете свободно общаться с носителями языка, понимать сложные тексты и аргументировать свою точку зрения.',
    C1: 'Продвинутый уровень. Вы можете свободно и спонтанно выражать свои мысли, используя язык гибко и эффективно в профессиональных и академических целях.',
    C2: 'Уровень владения в совершенстве. Вы понимаете практически всё услышанное и прочитанное, можете свободно выражать свои мысли в любой ситуации.',
  }
  return descriptions[level]
}

export function getLevelColor(level: EnglishLevel): string {
  const colors: Record<EnglishLevel, string> = {
    A1: '#ef4444',
    A2: '#f97316',
    B1: '#eab308',
    B2: '#22c55e',
    C1: '#3b82f6',
    C2: '#8b5cf6',
  }
  return colors[level]
}
