"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { quizSteps } from "@/components/onboarding/onboarding-steps"
import { OptionCard } from "@/components/onboarding/option-card"
import { OnboardingIllustration } from "@/components/onboarding/onboarding-illustration"
import { questions } from "@/lib/level-test-questions"
import {
  calculateLevel,
  getLevelDescription,
  getLevelColor,
} from "@/lib/level-utils"

const ONBOARDING_COUNT = quizSteps.length
const QUESTION_COUNT = questions.length
const TOTAL_STEPS = ONBOARDING_COUNT + QUESTION_COUNT

const CATEGORY_LABELS: Record<string, string> = {
  grammar: "Грамматика",
  vocabulary: "Словарный запас",
  reading: "Чтение",
}

type Phase = "onboarding" | "quiz" | "result"

export default function GetStartedPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<number, string>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})

  // Determine phase
  const phase: Phase =
    currentStep < ONBOARDING_COUNT
      ? "onboarding"
      : currentStep < TOTAL_STEPS
        ? "quiz"
        : "result"

  const questionIndex = currentStep - ONBOARDING_COUNT
  const question = phase === "quiz" ? questions[questionIndex] : null

  // Onboarding step data
  const onboardingStep = phase === "onboarding" ? quizSteps[currentStep] : null
  const selectedOnboardingOption = onboardingStep
    ? onboardingAnswers[onboardingStep.id] ?? null
    : null
  const selectedQuizAnswer = question ? quizAnswers[question.id] : undefined

  // Can continue?
  const canContinue =
    phase === "onboarding"
      ? selectedOnboardingOption !== null
      : phase === "quiz"
        ? selectedQuizAnswer !== undefined
        : false

  // Progress percentage
  const progressPercent = ((currentStep + 1) / TOTAL_STEPS) * 100

  // Quiz results
  const result = useMemo(() => {
    if (phase !== "result") return null
    let score = 0
    for (const q of questions) {
      if (quizAnswers[q.id] === q.correctAnswer) score++
    }
    const level = calculateLevel(score)
    return { score, level, total: QUESTION_COUNT }
  }, [phase, quizAnswers])

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }, [currentStep])

  const handleContinue = useCallback(() => {
    if (!canContinue) return
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      // Last question → show result
      setCurrentStep(TOTAL_STEPS)
    }
  }, [currentStep, canContinue])

  const handleSelectOnboarding = useCallback(
    (optionId: string) => {
      if (!onboardingStep) return
      setOnboardingAnswers((prev) => ({ ...prev, [onboardingStep.id]: optionId }))
    },
    [onboardingStep]
  )

  const handleSelectQuizAnswer = useCallback(
    (answerIndex: number) => {
      if (!question) return
      setQuizAnswers((prev) => ({ ...prev, [question.id]: answerIndex }))
    },
    [question]
  )

  const handleSubmitResult = useCallback(async () => {
    if (!result) return
    try {
      localStorage.setItem("onboarding_answers", JSON.stringify(onboardingAnswers))
      await fetch("/api/level-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.fromEntries(
          Object.entries(quizAnswers).map(([k, v]) => [k, String(v)])
        ) }),
      })
    } catch {
      // ignore
    }
    router.push("/register")
  }, [result, onboardingAnswers, quizAnswers, router])

  // ===== RESULT SCREEN =====
  if (phase === "result" && result) {
    const color = getLevelColor(result.level)
    const description = getLevelDescription(result.level)
    const percentage = Math.round((result.score / result.total) * 100)
    const circumference = 2 * Math.PI * 54
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <h1 className="mb-8 text-3xl font-bold text-[#1E1E1E]">
            Ваш результат
          </h1>

          <div className="relative mx-auto mb-8 flex items-center justify-center">
            <svg width="160" height="160" viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#f0f0f0" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-bold" style={{ color }}>
                {result.level}
              </span>
              <span className="text-sm text-gray-500">
                {result.score}/{result.total}
              </span>
            </div>
          </div>

          <p className="mb-8 text-sm leading-relaxed text-gray-600">
            {description}
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSubmitResult}
              className="w-full rounded-xl bg-[#CC3A3A] py-4 text-base font-semibold text-white shadow-lg shadow-[#CC3A3A]/25 hover:bg-[#B53333]"
            >
              Зарегистрироваться и начать
            </button>
            <Link
              href="/"
              className="py-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Вернуться на главную
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ===== Quiz illustration config =====
  const quizIllustrationBg =
    question?.category === "grammar"
      ? "#F0F5FF"
      : question?.category === "vocabulary"
        ? "#FFF0FB"
        : "#F0FFF5"

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---- LEFT PANEL ---- */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
        {phase === "onboarding" && onboardingStep ? (
          <OnboardingIllustration
            step={onboardingStep.id}
            selectedOption={selectedOnboardingOption}
            bgColor={onboardingStep.bgColor}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center"
            style={{ backgroundColor: quizIllustrationBg }}
          >
            <QuizIllustration
              category={question?.category ?? "grammar"}
              difficulty={question?.difficulty ?? "A1"}
              questionIndex={questionIndex}
            />
          </div>
        )}
      </div>

      {/* ---- RIGHT PANEL ---- */}
      <div className="flex flex-1 flex-col lg:w-1/2">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              currentStep === 0
                ? "cursor-not-allowed text-gray-300"
                : "text-gray-600 hover:bg-gray-100"
            )}
            aria-label="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Progress bar */}
          <div className="mx-4 flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full rounded-full bg-[#CC3A3A]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 text-center text-xs text-gray-400">
              {currentStep + 1} / {TOTAL_STEPS}
            </div>
          </div>

          <div className="h-10 w-10" />
        </div>

        {/* Mobile illustration */}
        {phase === "onboarding" && onboardingStep && (
          <div
            className="mx-auto h-40 w-full max-w-xs lg:hidden"
            style={{ backgroundColor: onboardingStep.bgColor, borderRadius: 12 }}
          >
            <OnboardingIllustration
              step={onboardingStep.id}
              selectedOption={selectedOnboardingOption}
              bgColor={onboardingStep.bgColor}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 lg:px-12">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              {phase === "onboarding" && onboardingStep ? (
                <motion.div
                  key={`onboarding-${onboardingStep.id}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <h1 className="mb-8 text-center text-2xl font-bold text-[#1E1E1E] lg:text-3xl">
                    {onboardingStep.question}
                  </h1>
                  <div className="flex flex-col gap-3">
                    {onboardingStep.options.map((option) => (
                      <OptionCard
                        key={option.id}
                        icon={option.icon}
                        label={option.label}
                        sublabel={option.sublabel}
                        selected={selectedOnboardingOption === option.id}
                        onClick={() => handleSelectOnboarding(option.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              ) : question ? (
                <motion.div
                  key={`quiz-${question.id}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {CATEGORY_LABELS[question.category]}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {question.difficulty}
                    </span>
                  </div>

                  {question.passage && (
                    <div className="mb-4 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 italic">
                      {question.passage}
                    </div>
                  )}

                  <h1 className="mb-6 text-xl font-bold text-[#1E1E1E] lg:text-2xl">
                    {question.question}
                  </h1>

                  <div className="flex flex-col gap-3">
                    {question.options.map((option, index) => {
                      const isSelected = selectedQuizAnswer === index
                      return (
                        <motion.button
                          key={index}
                          type="button"
                          onClick={() => handleSelectQuizAnswer(index)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left transition-colors",
                            isSelected
                              ? "border-[#CC3A3A] bg-[#FFF0F0]"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                          )}
                          aria-pressed={isSelected}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                              isSelected
                                ? "bg-[#CC3A3A] text-white"
                                : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-sm font-medium text-[#1E1E1E]">
                            {option}
                          </span>
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                              isSelected ? "border-[#CC3A3A]" : "border-gray-300"
                            )}
                          >
                            {isSelected && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="h-2.5 w-2.5 rounded-full bg-[#CC3A3A]"
                              />
                            )}
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Continue button */}
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              whileHover={canContinue ? { scale: 1.02 } : {}}
              whileTap={canContinue ? { scale: 0.98 } : {}}
              className={cn(
                "mt-8 w-full rounded-xl py-4 text-base font-semibold text-white transition-all",
                canContinue
                  ? "bg-[#CC3A3A] shadow-lg shadow-[#CC3A3A]/25 hover:bg-[#B53333]"
                  : "cursor-not-allowed bg-gray-300"
              )}
            >
              {currentStep === TOTAL_STEPS - 1 ? "Узнать результат" : "Продолжить"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===== Quiz step illustration ===== */

function QuizIllustration({
  category,
  difficulty,
  questionIndex,
}: {
  category: string
  difficulty: string
  questionIndex: number
}) {
  const levelColors: Record<string, string> = {
    A1: "#22c55e",
    A2: "#84cc16",
    B1: "#eab308",
    B2: "#f97316",
    C1: "#ef4444",
  }
  const barColor = levelColors[difficulty] ?? "#CC3A3A"
  const barHeight = { A1: 40, A2: 60, B1: 80, B2: 110, C1: 140 }[difficulty] ?? 80

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`q-${questionIndex}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 240 200" fill="none" className="h-[280px] w-[280px]">
            {category === "grammar" ? (
              <>
                {/* Book with grammar rules */}
                <rect x="60" y="50" width="120" height="120" rx="8" fill="white" stroke="#1E1E1E" strokeWidth="2" />
                <line x1="120" y1="50" x2="120" y2="170" stroke="#1E1E1E" strokeWidth="1.5" />
                <text x="80" y="80" fontSize="10" fill="#1E1E1E" fontWeight="bold">Aa</text>
                <text x="130" y="80" fontSize="10" fill={barColor} fontWeight="bold">{difficulty}</text>
                {[0, 1, 2, 3].map((i) => (
                  <rect key={i} x="75" y={90 + i * 16} width="35" height="6" rx="3" fill={barColor} opacity={0.15 + i * 0.2} />
                ))}
                {[0, 1, 2, 3].map((i) => (
                  <rect key={i} x="130" y={90 + i * 16} width="35" height="6" rx="3" fill={barColor} opacity={0.15 + i * 0.2} />
                ))}
              </>
            ) : category === "vocabulary" ? (
              <>
                {/* Word bubbles */}
                {[
                  { x: 50, y: 60, w: 70, h: 32 },
                  { x: 130, y: 45, w: 65, h: 32 },
                  { x: 70, y: 110, w: 80, h: 32 },
                  { x: 140, y: 100, w: 55, h: 32 },
                  { x: 90, y: 155, w: 60, h: 32 },
                ].map((b, i) => (
                  <g key={i}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="16" fill="white" stroke={barColor} strokeWidth="2" />
                    <text x={b.x + b.w / 2} y={b.y + 20} textAnchor="middle" fontSize="11" fill="#1E1E1E" fontWeight="500">
                      {["word", "speak", "learn", "know", "read"][i]}
                    </text>
                  </g>
                ))}
                <text x="120" y="25" textAnchor="middle" fontSize="12" fill={barColor} fontWeight="bold">{difficulty}</text>
              </>
            ) : (
              <>
                {/* Reading - document with magnifying glass */}
                <rect x="70" y="30" width="100" height="140" rx="6" fill="white" stroke="#1E1E1E" strokeWidth="2" />
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <rect key={i} x="85" y={50 + i * 16} width={60 + (i % 3) * 10} height="5" rx="2.5" fill="#1E1E1E" opacity={0.1 + (i % 3) * 0.05} />
                ))}
                {/* magnifying glass */}
                <circle cx="175" cy="140" r="22" fill="none" stroke={barColor} strokeWidth="3" />
                <line x1="190" y1="156" x2="205" y2="171" stroke={barColor} strokeWidth="4" strokeLinecap="round" />
                <text x="175" y="145" textAnchor="middle" fontSize="12" fill={barColor} fontWeight="bold">{difficulty}</text>
              </>
            )}
            {/* difficulty bar */}
            <rect x="10" y={180 - barHeight} width="16" height={barHeight} rx="8" fill={barColor} opacity="0.3" />
          </svg>
        </motion.div>

        <span className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-gray-600">
          {CATEGORY_LABELS[category]} · Вопрос {questionIndex + 1} из {QUESTION_COUNT}
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
