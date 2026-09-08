"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { nb } from "@/lib/ru/typo"

export type LectureForModal = {
  id: string
  title: string
  description: string | null
  host_name: string | null
  tag: string | null
  scheduled_at: string
  teacher?: { name: string; avatar_url: string | null; bio: string | null } | null
  /** Ученик уже записан (из /api/lectures). */
  registered?: boolean
}

type Props = {
  lecture: LectureForModal | null
  onClose: () => void
  /** После успешной записи — родитель перечитывает лекции (расписание). */
  onRegistered?: () => void
}

// Карточка преподавателя лектория — Figma 2522:4239 (Group 288, 812×755):
// фото 366×366 at (57,57); справа (x=458) имя 32 bold, «о программе» 15px,
// описание лекции 24px; под фото (x=63, y=529) «о преподавателе» + био 24px;
// кнопка «Записаться» 184×53 at (571,634). Регистрация — POST /api/lectures/register.
// Если препод не найден по host_name — инициалы вместо фото, блок био скрыт.
export default function StudentLectureModal({ lecture, onClose, onRegistered }: Props) {
  const [busy, setBusy] = useState(false)
  const [registeredNow, setRegisteredNow] = useState(false)
  const registered = registeredNow || !!lecture?.registered
  const [error, setError] = useState<string | null>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)

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
      setRegisteredNow(true)
      onRegistered?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="st-lect-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="st-lect-modal" role="dialog" aria-modal="true">
        <button type="button" className="st-lect-modal-close" onClick={onClose} aria-label="Закрыть">
          {/* крестик — экспорт Figma Group 130 (лаймовый) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
        </button>

        <div className="st-lect-modal-photo">
          {avatar && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
          ) : (
            <div className="st-lect-modal-initials">{initials || "T"}</div>
          )}
        </div>

        <div className="st-lect-modal-body">
          <div className="st-lect-modal-name">{hostName}</div>
          {lecture.description && (
            <>
              <div className="st-lect-modal-sub">о программе</div>
              <p className="st-lect-modal-desc">{nb(lecture.description)}</p>
            </>
          )}
        </div>

        <div className="st-lect-modal-about">
          {bio && (
            <>
              <div className="st-lect-modal-sub">о преподавателе</div>
              <p className="st-lect-modal-bio">{nb(bio)}</p>
            </>
          )}
        </div>

        <div className="st-lect-modal-foot">
          {error && <div className="st-lect-modal-err">{error}</div>}
          <button
            type="button"
            className={`st-lect-modal-cta${busy ? " busy" : ""}`}
            onClick={register}
            disabled={busy || registered}
          >
            {registered ? "Вы записаны" : "Записаться"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
