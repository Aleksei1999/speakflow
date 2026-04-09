/**
 * Промпты для AI-генерации отчётов по урокам.
 *
 * Формат вывода: структурированный JSON для парсинга и сохранения
 * в таблицу lesson_summaries.
 */

export const LESSON_SUMMARY_SYSTEM_PROMPT = `Ты — опытный преподаватель английского языка и AI-ассистент платформы SpeakFlow (RAW English). Твоя задача — на основе заметок преподавателя создать подробный, полезный и мотивирующий отчёт об уроке для студента.

ПРАВИЛА:
1. Пиши на русском языке. Английские слова, фразы и грамматические термины выделяй — они должны быть легко заметны.
2. Будь конкретным и полезным: приводи примеры, объясняй правила, давай контекст.
3. Тон — дружелюбный, поддерживающий, профессиональный. Отмечай успехи студента.
4. Домашнее задание должно быть выполнимым и связанным с темами урока.
5. Если преподаватель указал конкретные слова или грамматические темы, включи их обязательно.
6. Для каждого слова в словаре дай перевод и пример использования в предложении.

ФОРМАТ ОТВЕТА — строго JSON:
{
  "summary": "Краткое резюме урока (2-4 предложения, что изучали, какие темы затронули)",
  "vocabulary": [
    {
      "word": "английское слово или фраза",
      "translation": "перевод на русский",
      "example": "пример предложения с этим словом на английском"
    }
  ],
  "grammar_points": [
    "Описание грамматического правила или темы на русском с примерами на английском"
  ],
  "homework": "Конкретное домашнее задание (2-3 задания)",
  "strengths": "Что у студента получилось хорошо на этом уроке (1-3 пункта)",
  "areas_to_improve": "Над чем стоит поработать (1-3 пункта, конструктивно и мотивирующе)"
}

Отвечай ТОЛЬКО валидным JSON без markdown-обёрток.`

export function buildUserPrompt(input: {
  teacherInput: string
  vocabulary?: string[]
  grammarPoints?: string[]
  homework?: string
}): string {
  let prompt = `Заметки преподавателя по уроку:\n\n${input.teacherInput}`

  if (input.vocabulary && input.vocabulary.length > 0) {
    prompt += `\n\nСлова и фразы, которые изучали на уроке:\n${input.vocabulary.join(', ')}`
  }

  if (input.grammarPoints && input.grammarPoints.length > 0) {
    prompt += `\n\nГрамматические темы урока:\n${input.grammarPoints.join(', ')}`
  }

  if (input.homework) {
    prompt += `\n\nПримечания преподавателя по домашнему заданию:\n${input.homework}`
  }

  return prompt
}

/**
 * Тип структурированного ответа от OpenAI.
 */
export interface LessonSummaryAIResponse {
  summary: string
  vocabulary: Array<{
    word: string
    translation: string
    example: string
  }>
  grammar_points: string[]
  homework: string
  strengths: string
  areas_to_improve: string
}

/**
 * Валидирует и парсит JSON-ответ от OpenAI.
 */
export function parseSummaryResponse(content: string): LessonSummaryAIResponse | null {
  try {
    // Убираем возможные markdown-обёртки
    let cleaned = content.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    const parsed = JSON.parse(cleaned) as LessonSummaryAIResponse

    // Базовая валидация полей
    if (
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.vocabulary) ||
      !Array.isArray(parsed.grammar_points) ||
      typeof parsed.homework !== 'string' ||
      typeof parsed.strengths !== 'string' ||
      typeof parsed.areas_to_improve !== 'string'
    ) {
      console.error('[openai] Ответ не соответствует ожидаемой структуре')
      return null
    }

    // Валидируем каждый элемент vocabulary
    parsed.vocabulary = parsed.vocabulary.filter(
      (item) =>
        typeof item.word === 'string' &&
        typeof item.translation === 'string' &&
        typeof item.example === 'string'
    )

    return parsed
  } catch (err) {
    console.error('[openai] Ошибка парсинга ответа:', err)
    return null
  }
}
