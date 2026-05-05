'use client'

import { useState, useCallback, useMemo } from 'react'
import { questions, type Question } from '@/lib/level-test-questions'
import {
  calculateLevel,
  getLevelDescription,
  getLevelColor,
  type EnglishLevel,
} from '@/lib/level-utils'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type Screen = 'welcome' | 'quiz' | 'email' | 'result'

const CATEGORY_LABELS: Record<Question['category'], string> = {
  grammar: 'Грамматика',
  vocabulary: 'Словарный запас',
  reading: 'Чтение',
}

function AnimatedScoreCircle({
  score,
  total,
  level,
  color,
}: {
  score: number
  total: number
  level: EnglishLevel
  color: string
}) {
  const percentage = Math.round((score / total) * 100)
  const circumference = 2 * Math.PI * 54
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 120 120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/40"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {level}
        </span>
        <span className="text-sm text-muted-foreground">
          {score}/{total}
        </span>
      </div>
    </div>
  )
}

export default function LevelTestPage() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number
    level: EnglishLevel
    totalQuestions: number
  } | null>(null)

  const question = questions[currentQuestion]
  const totalQuestions = questions.length
  const progressPercent = ((currentQuestion + 1) / totalQuestions) * 100

  const selectedAnswer = question ? answers[question.id] : undefined

  const handleSelectAnswer = useCallback(
    (questionId: string, answerIndex: number) => {
      setAnswers((prev) => ({ ...prev, [questionId]: String(answerIndex) }))
    },
    []
  )

  const handleNext = useCallback(() => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion((prev) => prev + 1)
    } else {
      setScreen('email')
    }
  }, [currentQuestion, totalQuestions])

  const handlePrev = useCallback(() => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1)
    }
  }, [currentQuestion])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/level-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error('Submit failed')
      }

      const data = await response.json()
      setResult(data)
      setScreen('result')
    } catch {
      // Fallback: calculate locally if API fails
      let score = 0
      for (const q of questions) {
        if (answers[q.id] !== undefined && parseInt(answers[q.id], 10) === q.correctAnswer) {
          score++
        }
      }
      const level = calculateLevel(score)
      setResult({ score, level, totalQuestions })
      setScreen('result')
    } finally {
      setIsSubmitting(false)
    }
  }, [answers, email, totalQuestions])

  const handleRestart = useCallback(() => {
    setScreen('welcome')
    setCurrentQuestion(0)
    setAnswers({})
    setEmail('')
    setResult(null)
  }, [])

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])

  // ----- WELCOME SCREEN -----
  if (screen === 'welcome') {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-2xl">
              Определите ваш уровень английского
            </CardTitle>
            <CardDescription className="text-base">
              Тест определит ваш уровень английского за 5 минут
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3">
                <span className="text-2xl">5</span>
                <span className="text-muted-foreground">Грамматика</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3">
                <span className="text-2xl">5</span>
                <span className="text-muted-foreground">Лексика</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-3">
                <span className="text-2xl">5</span>
                <span className="text-muted-foreground">Чтение</span>
              </div>
            </div>
            <ul className="space-y-2 text-left text-sm text-muted-foreground">
              <li>15 вопросов разного уровня сложности</li>
              <li>От Raw (начальный) до Medium Well (продвинутый)</li>
              <li>Узнаешь свою «степень прожарки» сразу после теста</li>
            </ul>
            <Button size="lg" onClick={() => setScreen('quiz')}>
              Начать тест
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ----- QUIZ SCREEN -----
  if (screen === 'quiz' && question) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Вопрос {currentQuestion + 1} из {totalQuestions}
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                {CATEGORY_LABELS[question.category]} &middot; {question.difficulty}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>

          {/* Question card */}
          <Card>
            <CardHeader>
              {question.passage && (
                <div className="mb-3 rounded-lg bg-muted p-4 text-sm leading-relaxed italic">
                  {question.passage}
                </div>
              )}
              <CardTitle className="text-lg leading-snug">
                {question.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {question.options.map((option, index) => {
                const isSelected = selectedAnswer === String(index)
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectAnswer(question.id, index)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5 font-medium text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentQuestion === 0}
            >
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              Отвечено: {answeredCount}/{totalQuestions}
            </span>
            <Button
              onClick={handleNext}
              disabled={selectedAnswer === undefined}
            >
              {currentQuestion === totalQuestions - 1 ? 'Завершить' : 'Далее'}
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // ----- EMAIL CAPTURE SCREEN -----
  if (screen === 'email') {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Почти готово!</CardTitle>
            <CardDescription>
              Оставьте email, чтобы сохранить результат и получить
              персональные рекомендации. Это необязательно.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (необязательно)</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Отправка...' : 'Узнать результат'}
            </Button>
            <Button
              variant="ghost"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-muted-foreground"
            >
              Пропустить и узнать результат
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // ----- RESULT SCREEN -----
  if (screen === 'result' && result) {
    const color = getLevelColor(result.level)
    const description = getLevelDescription(result.level)

    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Ваш результат</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <AnimatedScoreCircle
              score={result.score}
              total={result.totalQuestions}
              level={result.level}
              color={color}
            />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Уровень:{' '}
                <span style={{ color }}>{result.level}</span>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 pt-2">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: 'lg' }))}
              >
                Зарегистрироваться и начать учиться
              </Link>
              <Button variant="outline" onClick={handleRestart}>
                Пройти тест заново
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return null
}
