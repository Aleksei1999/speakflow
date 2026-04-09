// @ts-nocheck
import { NextResponse } from 'next/server'
import { levelTestSubmitSchema } from '@/lib/validations'
import { questions } from '@/lib/level-test-questions'
import { calculateLevel } from '@/lib/level-utils'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const parsed = levelTestSubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Некорректные данные', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { answers, email } = parsed.data

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

    const { error: insertError } = await supabase.from('level_tests').insert({
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
