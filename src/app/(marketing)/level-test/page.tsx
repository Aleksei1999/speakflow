// @ts-nocheck
import type { Metadata } from "next"
import LevelTestClient from "./_client"

export const metadata: Metadata = {
  title: "Тест уровня английского — Raw English",
  description:
    "Бесплатный тест уровня английского за 5 минут. 15 вопросов: грамматика, лексика, чтение. Получи свою «прожарку» от Raw до Well Done.",
}

// Marketing landing for the level test (questions are static, scoring lives in /api).
// Regenerate at most once per day.
export const revalidate = 86400

export default function LevelTestPage() {
  return <LevelTestClient />
}
