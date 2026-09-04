"use client"

/* ============================================================
   Карточка ученика для админа. По макету:
     • Левая колонка — квадратное фото (с камерой для upload) + строка огоньков (streak).
     • Правая колонка — имя, «Послений комментарий о ученике» (bio от учителя),
       3 стат-строки (занятия/лекции/клубы).
     • Низ — почта / телефон / пароль-хэндл, баланс-пилюля и кнопки
       «Открыть чат», «Открыть расписание».
   Данные тянет по GET /api/admin/students/[id]. Аватар грузится через
   POST /api/admin/students/[id]/avatar.
   ============================================================ */

import { useEffect, useRef, useState } from "react"

const AVATAR_PALETTE = ["#5f7a8b", "#8f5a2b", "#5e6b3a", "#3d5566", "#7a3a54", "#b58f2a"]
function initialsOf(n: string) {
  const parts = n.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
}
function paletteFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}
function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(!src)
  if (!src || failed) {
    return (
      <div className="asm-avatar-fb" style={{ background: paletteFor(name) }} aria-hidden>
        {initialsOf(name)}
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setFailed(true)} />
}

interface Props {
  studentId: string
  seedName: string
  seedAvatar: string | null
  onClose: () => void
  onOpenChat: (peer: { id: string; name: string; avatar: string | null }) => void
  onOpenSchedule: (studentId: string) => void
}

interface StudentDetails {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  phone: string | null
  english_level: string | null
  balance_rub: number
  current_streak: number
  lessons_completed: number
  lessons_this_year: number
  bio_content: string | null
  bio_author_name: string | null
}

export default function AdminStudentModal({
  studentId,
  seedName,
  seedAvatar,
  onClose,
  onOpenChat,
  onOpenSchedule,
}: Props) {
  const [data, setData] = useState<StudentDetails | null>(null)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`/api/admin/students/${studentId}`, { cache: "no-store" })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setData(j.student as StudentDetails)
      } catch {
        /* fail-soft: остаёмся с seed-данными */
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [studentId])

  // ESC → закрыть.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Файл больше 5 МБ")
      return
    }
    setUploadError(null)
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch(`/api/admin/students/${studentId}/avatar`, {
        method: "POST",
        body: fd,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || "Ошибка загрузки")
      setAvatarOverride(j.avatar_url as string)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setAvatarUploading(false)
    }
  }

  const name = data?.full_name || seedName
  const avatar = avatarOverride ?? data?.avatar_url ?? seedAvatar
  const streak = data?.current_streak ?? 0
  const balance = data?.balance_rub ?? 0
  const lessonsYear = data?.lessons_this_year ?? 0
  const bio = data?.bio_content
  const bioAuthor = data?.bio_author_name

  return (
    <div className="asm-backdrop" onClick={onClose}>
      <link rel="stylesheet" href="/dashboard/admin-student-modal.css?v=20260901c" />
      <div className="asm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="asm-close" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="asm-grid">
          {/* Photo + streak flames */}
          <div className="asm-photo-col">
            <button
              type="button"
              className="asm-photo"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              aria-label="Изменить фото ученика"
            >
              <Avatar name={name} src={avatar ?? undefined} />
              <span className="asm-photo-cam" aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path d="M4 7h4l1.5-2h5L16 7h4v12H4V7z" stroke="#1E1E1E" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="4" stroke="#1E1E1E" strokeWidth="2" />
                </svg>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
            {uploadError && <div className="asm-upload-err">{uploadError}</div>}

            <div className="asm-flames" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="asm-flame" src="/dashboard/student/flame/empty.svg" alt="" />
              ))}
            </div>
          </div>

          {/* Name + bio + stats */}
          <div className="asm-info-col">
            <h2 className="asm-name">{name}</h2>

            <div className="asm-bio-wrap">
              <div className="asm-bio-label">Послений комментарий о ученике</div>
              {bio ? (
                <div className="asm-bio">
                  {bio.split(/\r?\n/).map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              ) : (
                <div className="asm-bio asm-bio--empty">Учитель ещё не оставил комментарий.</div>
              )}
              {bioAuthor && <div className="asm-bio-author">{bioAuthor}</div>}
            </div>

            <div className="asm-stats">
              <div className="asm-stat">
                <div className="asm-stat-num">{lessonsYear}</div>
                <div className="asm-stat-label">количество<br />занятий с начала года</div>
              </div>
              <div className="asm-stat">
                <div className="asm-stat-num">0</div>
                <div className="asm-stat-label">количество<br />лекций</div>
              </div>
              <div className="asm-stat">
                <div className="asm-stat-num">0</div>
                <div className="asm-stat-label">участие в клубах<br />по интересам</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts + balance/actions */}
        <div className="asm-foot">
          <div className="asm-contacts">
            <div>
              <div className="asm-contact-label">почта</div>
              <div className="asm-contact-val">{data?.email || "—"}</div>
            </div>
            <div>
              <div className="asm-contact-label">телефон</div>
              <div className="asm-contact-val">{data?.phone || "—"}</div>
            </div>
          </div>
          <div className="asm-actions">
            <div className="asm-balance-pill" aria-label={`Баланс: ${balance} рублей`}>
              <span className="asm-balance-cap">баланс:</span>
              <div className="asm-balance-value">
                <span className="asm-balance-num">{balance.toLocaleString("ru-RU")}</span>
                <span className="asm-balance-unit">рублей</span>
              </div>
            </div>
            <button
              type="button"
              className="asm-btn asm-btn--schedule"
              onClick={() => onOpenSchedule(studentId)}
            >
              Открыть расписание
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
