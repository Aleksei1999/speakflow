"use client"

// Модалка «О собеседнике» — открывается из + меню ChatModal.
// Показывает публичный профиль: имя, аватар, роль, level, интересы, город и т.д.

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface PeerProfile {
  id: string
  fullName: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: string
  city: string | null
  timezone: string | null
  occupation: string | null
  englishGoal: string | null
  interests: string[]
  createdAt: string
  englishLevel: string | null
  teacher: null | {
    bio: string | null
    education: string | null
    experienceYears: number | null
    hourlyRate: number
    rating: number
    totalLessons: number
    specializations: string[]
    languages: string[]
  }
}

interface Props {
  open: boolean
  peerId: string
  peerFallbackName?: string
  peerFallbackAvatar?: string | null
  onClose: () => void
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("ru", { month: "long", year: "numeric" })
}

export default function PeerInfoModal({ open, peerId, peerFallbackName, peerFallbackAvatar, onClose }: Props) {
  const [profile, setProfile] = useState<PeerProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    if (!open || !peerId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setAvatarFailed(false)
    fetch(`/api/chat/peer/${encodeURIComponent(peerId)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return
        if (!ok) throw new Error(j?.error ?? "load failed")
        setProfile(j.profile)
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, peerId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  const displayName = profile?.fullName ?? peerFallbackName ?? "Пользователь"
  const displayAvatar = profile?.avatarUrl ?? peerFallbackAvatar ?? null
  const roleLabel = profile?.role === "teacher" ? "Преподаватель" : profile?.role === "admin" ? "Администратор" : "Ученик"

  return createPortal(
    <div className="pi-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pi-card" role="dialog" aria-modal="true" aria-label={`О пользователе ${displayName}`}>
        <button type="button" className="pi-close" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="16" height="16" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="pi-head">
          <div className="pi-avatar">
            {displayAvatar && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayAvatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="pi-avatar-fb">{initialsOf(displayName)}</span>
            )}
          </div>
          <div className="pi-head-text">
            <h2 className="pi-name">{displayName}</h2>
            <div className="pi-role">{roleLabel}</div>
            {profile?.englishLevel && (
              <div className="pi-level">Уровень английского: <b>{profile.englishLevel}</b></div>
            )}
          </div>
        </div>

        {loading && <div className="pi-empty">Загружаем…</div>}
        {error && <div className="pi-empty pi-empty--err">Ошибка: {error}</div>}

        {profile && (
          <div className="pi-body">
            {profile.teacher?.bio && (
              <div className="pi-section">
                <div className="pi-section-title">О преподавателе</div>
                <p className="pi-section-text">{profile.teacher.bio}</p>
              </div>
            )}
            {profile.teacher?.education && (
              <div className="pi-section">
                <div className="pi-section-title">Образование</div>
                <p className="pi-section-text">{profile.teacher.education}</p>
              </div>
            )}
            {profile.teacher && (
              <div className="pi-stats">
                {profile.teacher.experienceYears != null && (
                  <div className="pi-stat">
                    <div className="pi-stat-value">{profile.teacher.experienceYears}</div>
                    <div className="pi-stat-label">лет опыта</div>
                  </div>
                )}
                {profile.teacher.totalLessons > 0 && (
                  <div className="pi-stat">
                    <div className="pi-stat-value">{profile.teacher.totalLessons}</div>
                    <div className="pi-stat-label">проведено уроков</div>
                  </div>
                )}
                {profile.teacher.rating > 0 && (
                  <div className="pi-stat">
                    <div className="pi-stat-value">{profile.teacher.rating.toFixed(1)}</div>
                    <div className="pi-stat-label">рейтинг</div>
                  </div>
                )}
              </div>
            )}
            {profile.englishGoal && (
              <div className="pi-section">
                <div className="pi-section-title">Цель изучения</div>
                <p className="pi-section-text">{profile.englishGoal}</p>
              </div>
            )}
            {profile.occupation && (
              <div className="pi-row"><span className="pi-row-label">Профессия</span><span>{profile.occupation}</span></div>
            )}
            {profile.city && (
              <div className="pi-row"><span className="pi-row-label">Город</span><span>{profile.city}</span></div>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <div className="pi-section">
                <div className="pi-section-title">Интересы</div>
                <div className="pi-tags">
                  {profile.interests.map((tag) => (
                    <span key={tag} className="pi-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.teacher?.specializations && profile.teacher.specializations.length > 0 && (
              <div className="pi-section">
                <div className="pi-section-title">Специализация</div>
                <div className="pi-tags">
                  {profile.teacher.specializations.map((tag) => (
                    <span key={tag} className="pi-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pi-row pi-row--muted">
              <span className="pi-row-label">На платформе с</span>
              <span>{formatMemberSince(profile.createdAt)}</span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
