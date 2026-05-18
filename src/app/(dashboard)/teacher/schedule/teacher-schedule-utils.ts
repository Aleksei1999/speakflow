import type { TimeLocale } from "@/lib/time"

export function asTimeLocale(locale: string): TimeLocale {
  return locale === "en" ? "en" : "ru"
}

export function pluralKey(
  n: number,
  locale: TimeLocale
): "Empty" | "One" | "Few" | "Many" {
  if (n === 0) return "Empty"
  if (locale === "en") return n === 1 ? "One" : "Many"
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return "Many"
  if (mod10 === 1) return "One"
  if (mod10 >= 2 && mod10 <= 4) return "Few"
  return "Many"
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "??"
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  )
}

export function nextRoundHour(d: Date): { date: Date; hour: number } {
  const h = d.getHours() + 1
  const date = new Date(d)
  date.setHours(h, 0, 0, 0)
  return { date, hour: h }
}
