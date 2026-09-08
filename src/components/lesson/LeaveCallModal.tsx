"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface Props {
  open: boolean
  canEndForAll: boolean
  onClose: () => void
  onLeave: () => void
  onEndForAll: () => void
}

// Крестик — экспорт Figma Group 130 (2522:3053), общий с модалками кабинета
function CloseIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
}

export default function LeaveCallModal({
  open,
  canEndForAll,
  onClose,
  onLeave,
  onEndForAll,
}: Props) {
  // Figma 2522:3056: после выбора выбранная кнопка остаётся яркой, вторая бледнеет (50%);
  // действие выполняем с небольшой задержкой, чтобы состояние было видно
  const [choice, setChoice] = useState<"leave" | "end" | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const choose = (kind: "leave" | "end", action: () => void) => {
    if (choice) return
    setChoice(kind)
    timer.current = window.setTimeout(() => { setChoice(null); action() }, 350)
  }
  const handleClose = () => { setChoice(null); onClose() }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setChoice(null); onClose() }
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="vc-leave-backdrop" onClick={handleClose}>
      <div
        className="vc-leave"
        role="dialog"
        aria-modal="true"
        aria-label="Завершить звонок"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="vc-leave-close"
          aria-label="Закрыть"
          onClick={handleClose}
        >
          <CloseIcon />
        </button>
        <button
          type="button"
          className={`vc-leave-btn vc-leave-btn--leave${choice && choice !== "leave" ? " vc-leave-btn--dim" : ""}`}
          onClick={() => choose("leave", onLeave)}
          disabled={!!choice}
        >
          Покинуть звонок
        </button>
        {canEndForAll && (
          <button
            type="button"
            className={`vc-leave-btn vc-leave-btn--end${choice && choice !== "end" ? " vc-leave-btn--dim" : ""}`}
            onClick={() => choose("end", onEndForAll)}
            disabled={!!choice}
          >
            Завершить у всех
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
