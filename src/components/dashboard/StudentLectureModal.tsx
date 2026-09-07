"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export type LectureForModal = {
  id: string
  title: string
  description: string | null
  host_name: string | null
  tag: string | null
  scheduled_at: string
  teacher?: { name: string; avatar_url: string | null; bio: string | null } | null
}

type Props = {
  lecture: LectureForModal | null
  onClose: () => void
}

// Модалка карточки преподавателя, ведущего лекторий. Открывается по клику
// на плашку лектория у ученика: слева фото ведущего, справа название/тэг
// лекции, её описание, "о преподавателе"+био и кнопка "Записаться"
// (POST /api/lectures/register). Если препод не найден по host_name —
// показываем инициалы вместо фото и скрываем блок био.
export default function StudentLectureModal({ lecture, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lecture) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [lecture, onClose])

  if (!lecture) return null

  const hostName = lecture.teacher?.name || lecture.host_name || "Преподаватель"
  const avatar = lecture.teacher?.avatar_url ?? null
  const bio = lecture.teacher?.bio ?? null
  const initials = hostName.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("")

  async function register() {
    if (!lecture) return
    setBusy(true); setError(null)
    try {
      const r = await fetch("/api/lectures/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lecture.id }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || "Ошибка регистрации")
      setRegistered(true)
    } catch (e: any) {
      setError(e?.message || "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="st-lect-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="st-lect-modal" role="dialog" aria-modal="true">
        <button type="button" className="st-lect-modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <div className="st-lect-modal-photo">
          {avatar ? (
            <img src={avatar} alt={hostName} />
          ) : (
            <div className="st-lect-modal-initials">{initials || "T"}</div>
          )}
        </div>

        <div className="st-lect-modal-body">
          <div className="st-lect-modal-name">{hostName}</div>
          {lecture.tag && (
            <div className="st-lect-modal-tag"><span className="st-lect-modal-tag-badge">T</span>{lecture.tag}</div>
          )}

          {lecture.description && (
            <p className="st-lect-modal-desc">{lecture.description}</p>
          )}

          {bio && (
            <>
              <div className="st-lect-modal-sub">о преподавателе</div>
              <p className="st-lect-modal-bio">{bio}</p>
            </>
          )}

          {error && <div className="st-lect-modal-err">{error}</div>}

          <button
            type="button"
            className="st-lect-modal-cta"
            onClick={register}
            disabled={busy || registered}
          >
            {registered ? "Вы записаны" : busy ? "Записываем…" : "Записаться"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
