"use client"

// Figma 2208:3358 — «Время вашего занятия изменилось, проверьте календарь».
// Reusable notice: показываем ученику, когда учитель сдвинул урок.

import { createPortal } from "react-dom"
import { useEffect } from "react"

interface Props {
  open: boolean
  onClose: () => void
  onOpenCalendar: () => void
}

export default function StudentTimeChangedNotice({ open, onClose, onOpenCalendar }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/student-add-lesson.css?v=1" />
      <div className="sal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="sal-card sal-card--small" role="dialog" aria-modal="true">
          <button type="button" className="sal-close" aria-label="Закрыть" onClick={onClose}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="sal-success-title" style={{ marginTop: 8 }}>
            Время вашего занятия<br />изменилось, проверьте<br />календарь
          </h2>
          <div className="sal-footer">
            <button type="button" className="sal-btn sal-btn--red" onClick={onOpenCalendar}>
              Календарь
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
