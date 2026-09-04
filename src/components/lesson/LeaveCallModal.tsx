"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"

interface Props {
  open: boolean
  canEndForAll: boolean
  onClose: () => void
  onLeave: () => void
  onEndForAll: () => void
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path
        d="M2 2l16 16M18 2L2 18"
        stroke="#1E1E1E"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function LeaveCallModal({
  open,
  canEndForAll,
  onClose,
  onLeave,
  onEndForAll,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
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
    <div className="vc-leave-backdrop" onClick={onClose}>
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
          onClick={onClose}
        >
          <CloseIcon />
        </button>
        <button
          type="button"
          className="vc-leave-btn vc-leave-btn--leave"
          onClick={onLeave}
        >
          Покинуть звонок
        </button>
        {canEndForAll && (
          <button
            type="button"
            className="vc-leave-btn vc-leave-btn--end"
            onClick={onEndForAll}
          >
            Завершить у всех
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
