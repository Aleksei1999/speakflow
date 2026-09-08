"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { saveTeacherLessonNote } from "@/app/(teacher-full)/teacher/lesson-note-actions"

interface Props {
  open: boolean
  lessonId: string
  studentId: string
  studentName: string
  studentLevel: string
  studentAvatar?: string | null
  onClose: () => void
  onSaved?: () => void
}

// Крестик — экспорт Figma Group 130 (2522:3982), общий с модалками кабинета
function CloseIcon() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function normalizeLevel(lvl: string): string {
  if (lvl === "A1") return "А1"
  if (lvl === "A2") return "А2"
  return lvl
}

export default function PostLessonNoteModal({
  open,
  lessonId,
  studentName,
  studentLevel,
  studentAvatar,
  onClose,
  onSaved,
}: Props) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(!studentAvatar)

  useEffect(() => {
    if (!open) return
    setNote("")
    setSaving(false)
    setAvatarFailed(!studentAvatar)
  }, [open, studentAvatar])

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

  const submit = () => {
    setSaving(true)
    saveTeacherLessonNote({ lessonId, note })
      .then(() => {
        onSaved?.()
        onClose()
      })
      .catch((err) => {
        console.error("[lesson-note] save failed", err)
        setSaving(false)
      })
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="vc-note-backdrop" onClick={onClose}>
      {/* Figma 2522:3976 «После урока»: 686×609 — раскладка в .vc-note--post */}
      <div
        className="vc-note vc-note--post"
        role="dialog"
        aria-modal="true"
        aria-label="О последнем уроке"
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

        <div className="vc-note-head">
          <div className="vc-note-avatar">
            {studentAvatar && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studentAvatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="vc-note-avatar-fb">{initialsOf(studentName)}</span>
            )}
          </div>
          <div className="vc-note-name">{studentName}</div>
          <div className="vc-note-lvl">{normalizeLevel(studentLevel)}</div>
        </div>

        <div className="vc-note-title">О последнем уроке</div>

        <textarea
          className="vc-note-area"
          maxLength={500}
          placeholder={"добавьте комментарий\nо прошедшем уроке"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
        <div className="vc-note-counter">{note.length}/500</div>

        {/* busy: чёрная с лаймовым текстом, подпись не меняется */}
        <button
          type="button"
          className={`vc-note-btn${saving ? " busy" : ""}`}
          onClick={submit}
          disabled={saving}
        >
          Готово
        </button>
      </div>
    </div>,
    document.body,
  )
}
