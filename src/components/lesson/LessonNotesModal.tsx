"use client"

// In-call модалка «Заметки» — доступна учителю и ученику, каждый видит
// только свою запись (RLS в lesson_notes фильтрует по user_id). Пишет в
// существующий /api/lesson/notes (PUT — идемпотентный upsert).

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface Props {
  open: boolean
  lessonId: string
  onClose: () => void
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <path d="M2 2l16 16M18 2L2 18" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function LessonNotesModal({ open, lessonId, onClose }: Props) {
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !lessonId) return
    setLoading(true)
    setError(null)
    fetch(`/api/lesson/notes?lessonId=${encodeURIComponent(lessonId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const rows = (await r.json()) as Array<{ content: string }>
        setNote(rows[0]?.content ?? "")
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false))
  }, [open, lessonId])

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

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch("/api/lesson/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content: note }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error ?? `HTTP ${r.status}`)
      }
      onClose()
    } catch (e: any) {
      setError(String(e?.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="vc-note-backdrop" onClick={onClose}>
      <div
        className="vc-note vc-note--incall"
        role="dialog"
        aria-modal="true"
        aria-label="Заметки"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="vc-note-close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        <div className="vc-note-title">Заметки</div>

        <textarea
          className="vc-note-area vc-note-area--tall"
          placeholder={loading ? "Загружаем..." : "заметки по уроку — видны только вам"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={loading || saving}
        />
        {error && <div className="vc-note-error">Ошибка: {error}</div>}

        <button
          type="button"
          className="vc-note-btn"
          onClick={save}
          disabled={loading || saving}
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </div>,
    document.body,
  )
}
