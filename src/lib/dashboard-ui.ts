"use client"

import { useEffect, useState } from "react"

/** Текущее время, обновляется раз в 30 секунд; null до монтирования (SSR-safe). */
export function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Уровень для UI: латинские A1/A2 в макете набраны кириллицей. */
export function levelLabel(lvl: string): string {
  if (lvl === "A1") return "А1"
  if (lvl === "A2") return "А2"
  return lvl
}

/** Копейки → «55.400» (рубли, разделитель тысяч — точка, как в макете). */
export function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100)
  return String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
