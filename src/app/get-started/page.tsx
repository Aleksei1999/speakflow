"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { quizSteps } from "@/components/onboarding/onboarding-steps"
import { OptionCard } from "@/components/onboarding/option-card"
import { OnboardingIllustration } from "@/components/onboarding/onboarding-illustration"

const TOTAL_STEPS = quizSteps.length

export default function GetStartedPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const step = quizSteps[currentStep]
  const selectedOption = answers[step.id] ?? null

  const handleSelect = useCallback(
    (optionId: string) => {
      setAnswers((prev) => ({ ...prev, [step.id]: optionId }))
    },
    [step.id]
  )

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  const handleContinue = useCallback(() => {
    if (!selectedOption) return

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      // Last step -- save to localStorage and redirect
      const finalAnswers = { ...answers, [step.id]: selectedOption }
      try {
        localStorage.setItem(
          "onboarding_answers",
          JSON.stringify(finalAnswers)
        )
      } catch {
        // silently fail if localStorage unavailable
      }
      router.push("/level-test")
    }
  }, [currentStep, selectedOption, answers, step.id, router])

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---- LEFT PANEL: Illustration (hidden on mobile, shown on lg+) ---- */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
        <OnboardingIllustration
          step={step.id}
          selectedOption={selectedOption}
          bgColor={step.bgColor}
        />
      </div>

      {/* ---- RIGHT PANEL: Question ---- */}
      <div className="flex flex-1 flex-col lg:w-1/2">
        {/* Top bar: back + progress */}
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

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {quizSteps.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === currentStep
                    ? "w-6 bg-[#CC3A3A]"
                    : index < currentStep
                      ? "w-2 bg-[#CC3A3A] opacity-40"
                      : "w-2 bg-gray-300"
                )}
              />
            ))}
          </div>

          {/* Spacer for symmetry */}
          <div className="h-10 w-10" />
        </div>

        {/* Mobile illustration (small, on top) */}
        <div
          className="mx-auto h-40 w-full max-w-xs lg:hidden"
          style={{ backgroundColor: step.bgColor, borderRadius: 12 }}
        >
          <OnboardingIllustration
            step={step.id}
            selectedOption={selectedOption}
            bgColor={step.bgColor}
          />
        </div>

        {/* Question content */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 lg:px-12">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <h1 className="mb-8 text-center text-2xl font-bold text-[#1E1E1E] lg:text-3xl">
                  {step.question}
                </h1>

                <div className="flex flex-col gap-3">
                  {step.options.map((option) => (
                    <OptionCard
                      key={option.id}
                      icon={option.icon}
                      label={option.label}
                      sublabel={option.sublabel}
                      selected={selectedOption === option.id}
                      onClick={() => handleSelect(option.id)}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Continue button */}
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={!selectedOption}
              whileHover={selectedOption ? { scale: 1.02 } : {}}
              whileTap={selectedOption ? { scale: 0.98 } : {}}
              className={cn(
                "mt-8 w-full rounded-xl py-4 text-base font-semibold text-white transition-all",
                selectedOption
                  ? "bg-[#CC3A3A] shadow-lg shadow-[#CC3A3A]/25 hover:bg-[#B53333]"
                  : "cursor-not-allowed bg-gray-300"
              )}
            >
              Продолжить
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
