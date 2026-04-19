// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lessonSummaryInputSchema } from '@/lib/validations'
import { getOpenAI } from '@/lib/openai/client'
import {
  LESSON_SUMMARY_SYSTEM_PROMPT,
  buildUserPrompt,
  parseSummaryResponse,
} from '@/lib/openai/prompts'
import { sendNotification } from '@/lib/notifications/service'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Json } from '@/types/database'

/**
 * POST /api/ai/summary
 *
 * Генерирует AI-отчёт по уроку на основе заметок преподавателя.
 * Доступен только преподавателю урока. Урок должен быть в статусе 'completed'.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Валидация входных данных
    const parsed = lessonSummaryInputSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { lessonId, teacherInput, vocabulary, grammarPoints, homework } = parsed.data

    // Проверяем авторизацию
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Необходимо авторизоваться' },
        { status: 401 }
      )
    }

    // Получаем урок и проверяем права
    const adminClient = createAdminClient()
    const { data: lesson, error: lessonError } = await adminClient
      .from('lessons')
      .select('id, student_id, teacher_id, status, scheduled_at, duration_minutes')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json(
        { error: 'Урок не найден' },
        { status: 404 }
      )
    }

    // Только преподаватель урока может создавать отчёт
    if (lesson.teacher_id !== user.id) {
      return NextResponse.json(
        { error: 'Только преподаватель урока может создать отчёт' },
        { status: 403 }
      )
    }

    // Урок должен быть завершён
    if (lesson.status !== 'completed') {
      return NextResponse.json(
        { error: 'Отчёт можно создать только для завершённого урока' },
        { status: 400 }
      )
    }

    // Проверяем, нет ли уже отчёта для этого урока
    const { data: existingSummary } = await adminClient
      .from('lesson_summaries')
      .select('id')
      .eq('lesson_id', lessonId)
      .maybeSingle()

    if (existingSummary) {
      return NextResponse.json(
        { error: 'Отчёт для этого урока уже существует', summaryId: existingSummary.id },
        { status: 409 }
      )
    }

    // Генерируем AI-отчёт с retry
    const userPrompt = buildUserPrompt({
      teacherInput,
      vocabulary,
      grammarPoints,
      homework,
    })

    let aiResponse = await callOpenAI(userPrompt)

    // Retry один раз при ошибке
    if (!aiResponse) {
      console.warn('[ai/summary] Первая попытка не удалась, повторяем...')
      aiResponse = await callOpenAI(userPrompt)
    }

    // Формируем данные для сохранения
    let summaryData: {
      summary_text: string
      vocabulary: Json
      grammar_points: Json
      homework: string | null
      strengths: string | null
      areas_to_improve: string | null
      cefr_level: string | null
    }

    let tokensUsed: number | undefined

    if (aiResponse) {
      const { parsed: parsedResponse, tokens } = aiResponse
      tokensUsed = tokens

      if (parsedResponse) {
        summaryData = {
          summary_text: parsedResponse.summary,
          vocabulary: parsedResponse.vocabulary as unknown as Json,
          grammar_points: parsedResponse.grammar_points as unknown as Json,
          homework: parsedResponse.homework || homework || null,
          strengths: parsedResponse.strengths || null,
          areas_to_improve: parsedResponse.areas_to_improve || null,
          cefr_level: null,
        }
      } else {
        // Fallback: сохраняем заметки преподавателя как есть
        summaryData = buildFallbackSummary(teacherInput, vocabulary, grammarPoints, homework)
      }
    } else {
      // Полный fallback при отказе API
      summaryData = buildFallbackSummary(teacherInput, vocabulary, grammarPoints, homework)
    }

    // Сохраняем в БД
    const { data: savedSummary, error: saveError } = await adminClient
      .from('lesson_summaries')
      .insert({
        lesson_id: lessonId,
        student_id: lesson.student_id,
        teacher_id: lesson.teacher_id,
        ...summaryData,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('[ai/summary] Ошибка сохранения отчёта:', saveError)
      return NextResponse.json(
        { error: 'Ошибка сохранения отчёта' },
        { status: 500 }
      )
    }

    // Отправляем уведомление студенту
    const scheduledDate = new Date(lesson.scheduled_at)
    const dateStr = format(scheduledDate, 'd MMMM yyyy', { locale: ru })

    const { data: teacherProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', lesson.teacher_id)
      .single()

    // Уведомление отправляем асинхронно, не блокируя ответ
    sendNotification(lesson.student_id, 'lesson_summary_ready', {
      teacherName: teacherProfile?.full_name || 'Преподаватель',
      date: dateStr,
      summaryUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/summaries/${savedSummary.id}`,
    }).catch((err) => {
      console.error('[ai/summary] Ошибка отправки уведомления:', err)
    })

    // Логируем использование токенов
    if (tokensUsed) {
      console.info(`[ai/summary] Токены использованы: ${tokensUsed} (урок ${lessonId})`)
    }

    return NextResponse.json({
      summaryId: savedSummary.id,
      summary: summaryData,
      tokensUsed,
    })
  } catch (error) {
    console.error('[ai/summary] Непредвиденная ошибка:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// ---------- Вспомогательные функции ----------

async function callOpenAI(
  userPrompt: string
): Promise<{
  parsed: ReturnType<typeof parseSummaryResponse>
  tokens?: number
} | null> {
  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: LESSON_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      console.error('[ai/summary] Пустой ответ от OpenAI')
      return null
    }

    const tokens = completion.usage?.total_tokens

    return {
      parsed: parseSummaryResponse(content),
      tokens,
    }
  } catch (err) {
    console.error('[ai/summary] Ошибка вызова OpenAI API:', err)
    return null
  }
}

function buildFallbackSummary(
  teacherInput: string,
  vocabulary?: string[],
  grammarPoints?: string[],
  homework?: string
) {
  return {
    summary_text: teacherInput,
    vocabulary: (vocabulary || []).map((word) => ({
      word,
      translation: '',
      example: '',
    })) as unknown as Json,
    grammar_points: (grammarPoints || []) as unknown as Json,
    homework: homework || null,
    strengths: null,
    areas_to_improve: null,
    cefr_level: null,
  }
}
