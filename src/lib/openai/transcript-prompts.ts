// Промпт + Zod-схема для второго GPT-вызова в pipeline'е:
// transcript → структурированный конспект урока + мини-тест.
//
// Используется в /api/internal/cron/summarize-transcripts. Через
// response_format: { type: 'json_schema' } гарантируется валидный
// JSON, парсер не нужен.

import { z } from "zod"

export const TRANSCRIPT_SUMMARY_SYSTEM_PROMPT = `Ты — методист платформы Raw English. На входе у тебя транскрипт онлайн-урока английского между преподавателем (Teacher) и студентом (Student). Транскрипт автоматический и может содержать опечатки и пропуски — игнорируй их, восстанавливай смысл.

Твоя задача — собрать структурированный конспект урока для студента и тест на закрепление.

ПРАВИЛА:
1. Конспект и инструкции — на русском. Английские слова/фразы оставляй на английском.
2. Будь конкретным: цитируй то что реально обсуждалось, не придумывай.
3. Vocabulary — только те слова/фразы, которые реально звучали на уроке и которые имеет смысл выучить (НЕ названия, базовые слова уровня beginner, имена собственные).
4. Grammar — реальные правила/конструкции, разобранные на уроке. Не выдумывай темы.
5. Strengths / areas_to_improve — на основе речи студента. Что у него получалось, где были трудности. Если данных мало — короткие пункты.
6. Quiz — ровно 6 вопросов с 4 вариантами ответа. Только один правильный. correct_index — 0..3. Вопросы должны проверять материал именно этого урока, не общие знания.
7. Если урок был слишком короткий / транскрипт пустой / не на тему — верни summary с честным описанием и quiz из 6 общих вопросов по теме урока (если она угадывается) или базового английского.

Отвечай строго в формате JSON-schema, который задан в response_format.`

export function buildTranscriptUserPrompt(transcript: string, durationMin: number): string {
  return `Длительность урока: ~${durationMin} минут.

Транскрипт:
${transcript}`
}

// JSON Schema для response_format: json_schema. Поля те же что в
// lesson_summaries + новый quiz блок.
export const SUMMARY_RESPONSE_JSON_SCHEMA = {
  name: "lesson_summary_with_quiz",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "vocabulary",
      "grammar_points",
      "homework",
      "strengths",
      "areas_to_improve",
      "quiz",
    ],
    properties: {
      summary: {
        type: "string",
        description: "Краткое резюме урока на русском (2-4 предложения).",
      },
      vocabulary: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["word", "translation", "example"],
          properties: {
            word: { type: "string" },
            translation: { type: "string" },
            example: { type: "string" },
          },
        },
      },
      grammar_points: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      homework: {
        type: "string",
        description: "Домашнее задание (2-3 пункта) или пустая строка.",
      },
      strengths: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },
      areas_to_improve: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },
      quiz: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["q", "choices", "correct_index", "explanation"],
          properties: {
            q: { type: "string" },
            choices: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" },
            },
            correct_index: { type: "integer", minimum: 0, maximum: 3 },
            explanation: { type: "string" },
          },
        },
      },
    },
  },
} as const

// Zod-схема для второго барьера: даже если OpenAI вернул что-то не то,
// мы поймаем это на парсинге, а не свалимся при INSERT.
export const summaryResponseSchema = z.object({
  summary: z.string().min(1),
  vocabulary: z
    .array(
      z.object({
        word: z.string(),
        translation: z.string(),
        example: z.string(),
      })
    )
    .max(20),
  grammar_points: z.array(z.string()).max(10),
  homework: z.string(),
  strengths: z.array(z.string()).max(6),
  areas_to_improve: z.array(z.string()).max(6),
  quiz: z
    .array(
      z.object({
        q: z.string().min(1),
        choices: z.array(z.string()).min(2).max(6),
        correct_index: z.number().int().min(0).max(5),
        explanation: z.string(),
      })
    )
    .min(3)
    .max(10),
})

export type SummaryResponse = z.infer<typeof summaryResponseSchema>
