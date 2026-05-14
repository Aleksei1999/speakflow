"use client"

import { useEffect, useRef } from "react"

/**
 * Хук для модалок: ловит Escape, удерживает Tab в фокусной ловушке
 * и возвращает фокус прежнему элементу при закрытии.
 */
export function useModalA11y(
  open: boolean,
  onClose: () => void
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    if (typeof window === "undefined") return

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    if (!container) return

    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focusable[0]?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== "Tab") return
      const fb = container?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!fb || fb.length === 0) return
      const first = fb[0]
      const last = fb[fb.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("keydown", handleKey)
      try { previousFocusRef.current?.focus?.() } catch { /* noop */ }
    }
  }, [open, onClose])

  return containerRef
}
