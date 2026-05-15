import { NextResponse } from 'next/server'
import { levelTestSubmitSchema } from '@/lib/validations'
import { questions } from '@/lib/level-test-questions'
import { calculateLevel } from '@/lib/level-utils'
import { createClient } from '@/lib/supabase/server'
import { enforceRateLimitStrict, getClientIp } from '@/lib/api/rate-limit'
import { protectPublic, validateEmailField } from '@/lib/api/arcjet'

export async function POST(request: Request) {
  try {
    // Arcjet FIRST — shield + bot detection. Анонимный публичный
    // endpoint, лучшая первая линия защиты от автоматизированных
    // прогонов теста и payload-инъекций в JSON-полях.
    const ajDeny = await protectPublic(request as any)
    if (ajDeny) return ajDeny

    // Rate-limit: 10 submit/час на IP. fail-closed —
    // публичный endpoint, защита от автоматизированной накрутки.
    const limited = await enforceRateLimitStrict(request as any, {
      name: 'level-test:submit',
      keyParts: [getClientIp(request as any)],
      max: 10,
      windowSeconds: 60 * 60,
    })
    if (limited) return limited

    const body = await request.json()

    const parsed = levelTestSubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { answers, email } = parsed.data

    // Email опциональный (тест можно проходить и анонимно), но если он
    // прислан — отсеиваем disposable, мы потом будем по нему слать письмо.
    if (email) {
      const emailCheck = await validateEmailField(email)
      if (!emailCheck.valid) {
        const msg =
          emailCheck.reason === 'disposable'
            ? 'Укажите личный email, а не одноразовый'
            : emailCheck.reason === 'no_mx'
              ? 'Домен этого email не принимает почту'
              : 'Некорректный email'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    let score = 0
    for (const question of questions) {
      const userAnswer = answers[question.id]
      if (userAnswer !== undefined && parseInt(userAnswer, 10) === question.correctAnswer) {
        score++
      }
    }

    const level = calculateLevel(score)
    const totalQuestions = questions.length

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // FIXME(types): level_tests Insert in Database type lacks total_questions column
    const { error: insertError } = await (supabase.from('level_tests') as any).insert({
      score,
      level,
      total_questions: totalQuestions,
      answers,
      ...(user?.id ? { user_id: user.id } : {}),
      ...(email ? { email } : {}),
    })

    if (insertError) {
      console.error('Failed to save level test result:', insertError)
    }

    return NextResponse.json({ score, level, totalQuestions })
  } catch {
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
