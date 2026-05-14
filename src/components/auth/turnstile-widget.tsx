"use client"

// Cloudflare Turnstile React-обёртка. Подключается на login / register /
// forgot-password / teach-apply. Если NEXT_PUBLIC_TURNSTILE_SITE_KEY не
// задан — виджет не рендерится (вообще ничего не показывает), сервер
// тоже пропускает (см. verifyTurnstile).

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        opts: {
          sitekey: string
          callback?: (token: string) => void
          "error-callback"?: () => void
          "expired-callback"?: () => void
          theme?: "light" | "dark" | "auto"
          size?: "normal" | "compact" | "flexible"
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

let scriptLoaded = false
let scriptLoadingPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`
    )
    if (existing) {
      scriptLoaded = true
      resolve()
      return
    }
    const s = document.createElement("script")
    s.src = SCRIPT_URL
    s.async = true
    s.defer = true
    s.onload = () => {
      scriptLoaded = true
      resolve()
    }
    s.onerror = () => reject(new Error("turnstile script load failed"))
    document.head.appendChild(s)
  })
  return scriptLoadingPromise
}

export interface TurnstileWidgetProps {
  onToken: (token: string | null) => void
  theme?: "light" | "dark" | "auto"
  size?: "normal" | "compact" | "flexible"
}

/**
 * Простая React-обёртка. Когда юзер пройдёт challenge, onToken получит
 * token. Если token истечёт или ошибка — onToken(null), чтобы родитель
 * мог дизейблить submit.
 */
export function TurnstileWidget({ onToken, theme = "auto", size = "flexible" }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return
    if (!containerRef.current) return

    let mounted = true
    loadTurnstileScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: (token) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
        })
      })
      .catch(() => onToken(null))

    return () => {
      mounted = false
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
      }
      widgetIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  // Без site-key вообще ничего не рендерим — пусть формы работают без капчи.
  if (!siteKey) return null
  return <div ref={containerRef} />
}
