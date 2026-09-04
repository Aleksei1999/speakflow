import { NextRequest, NextResponse } from 'next/server'
import { lessonSummaryInputSchema } from '@/lib/validations'
import { requireLessonTeacherOrAdmin } from '@/lib/api/lesson-auth'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { generateLessonSummary } from '@/lib/ai/lesson-summary'

/**
 * POST /api/ai/summary
 *
 * Генерирует AI-отчёт по уроку на основе заметок преподавателя.
 * Доступен только преподавателю урока / админу. Урок должен быть в статусе
 * 'completed'. Основная логика в `lib/ai/lesson-summary.ts` — этот роут
 * лишь проверяет права + rate-limit и делегирует.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = lessonSummaryInputSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { error: firstError?.message || 'Некорректные данные' },
        { status: 400 }
      )
    }

    const { lessonId, teacherInput, vocabulary, grammarPoints, homework } = parsed.data

    // CRIT-2 fix: lessons.teacher_id хранит teacher_profiles.id, а не
    // auth.uid(). Общий gate правильно резолвит teacher_profiles → user_id.
    const gate = await requireLessonTeacherOrAdmin(lessonId)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    // Rate-limit: 5 summary/час на пользователя. fail-closed —
    // OpenAI gpt-4o-mini стоит денег, retry в helper × 2 запроса.
    const limited = await enforceRateLimitStrict(request, {
      name: 'ai:summary',
      keyParts: [gate.user.id, getClientIp(request)],
      max: 5,
      windowSeconds: 60 * 60,
    })
    if (limited) return limited

    const result = await generateLessonSummary({
      lessonId,
      teacherInput,
      vocabulary,
      grammarPoints,
      homework,
      admin: gate.admin,
    })

    if (!result.ok) {
      const status =
        result.code === 'not_completed' ? 400 :
        result.code === 'already_exists' ? 409 : 500
      return NextResponse.json(
        { error: result.message, summaryId: result.summaryId },
        { status },
      )
    }

    return NextResponse.json({
      summaryId: result.summaryId,
      tokensUsed: result.tokensUsed,
    })
  } catch (error) {
    console.error('[ai/summary] Непредвиденная ошибка:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
