"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect, useState } from "react"

const COPY = {
  ru: {
    title: "Не удалось загрузить страницу",
    subtitle: "Попробуйте обновить или вернитесь на главную панель.",
    retry: "Повторить",
    home: "На главную",
  },
  en: {
    title: "Could not load this page",
    subtitle: "Try refreshing or go back to your dashboard home.",
    retry: "Try again",
    home: "Dashboard home",
  },
} as const

type Locale = keyof typeof COPY

function readLocale(): Locale {
  if (typeof document === "undefined") return "ru"
  const m = document.cookie.match(/(?:^|;\s*)rwen_locale=(ru|en)/)
  return (m?.[1] as Locale) ?? "ru"
}

export function DashboardError({
  error,
  reset,
  homeHref,
}: {
  error: Error & { digest?: string }
  reset: () => void
  homeHref: string
}) {
  const [locale, setLocale] = useState<Locale>("ru")

  useEffect(() => {
    Sentry.captureException(error)
    setLocale(readLocale())
  }, [error])

  const t = COPY[locale]

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">{t.title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t.subtitle}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t.retry}
        </button>
        <Link
          href={homeHref}
          className="rounded-full border px-5 py-2 text-sm font-semibold"
        >
          {t.home}
        </Link>
      </div>
    </div>
  )
}
