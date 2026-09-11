"use client"

/* Карточка ученика для админа (Figma 2522:106). Данные — GET
   /api/admin/students/[id], аватар — POST /api/admin/students/[id]/avatar. */

import { useEffect, useRef, useState } from "react"
import { fromRoastLevel } from "@/lib/levels/mapping"
import { initialsOf, paletteFor } from "@/lib/ui/initials"
import { pluralize } from "@/lib/ru/plural"

const AVATAR_PALETTE = ["#5f7a8b", "#8f5a2b", "#5e6b3a", "#3d5566", "#7a3a54", "#b58f2a"]
function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(!src)
  if (!src || failed) {
    return (
      <div className="asm-avatar-fb" style={{ background: paletteFor(name, AVATAR_PALETTE) }} aria-hidden>
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
  lectures_count: number
  bio_content: string | null
  bio_author_name: string | null
}

export default function AdminStudentModal({
  studentId,
  seedName,
  seedAvatar,
  onClose,
  onOpenSchedule,
}: Props) {
  const [data, setData] = useState<StudentDetails | null>(null)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // «Сбросить пароль»: новый пароль показываем один раз, пока открыта карточка.
  const [resetState, setResetState] = useState<"idle" | "busy" | "done" | "error">("idle")
  const [newPassword, setNewPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  async function resetPassword() {
    if (resetState === "busy") return
    if (!window.confirm(`Сбросить пароль ученика ${data?.full_name || seedName}? Старый пароль перестанет работать.`)) return
    setResetState("busy")
    setCopied(false)
    try {
      const r = await fetch(`/api/admin/students/${studentId}/reset-password`, { method: "POST" })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.password) throw new Error(j.error || "Не удалось сбросить пароль")
      setNewPassword(j.password as string)
      setResetState("done")
    } catch {
      setResetState("error")
    }
  }

  async function copyPassword() {
    if (!newPassword) return
    try {
      await navigator.clipboard.writeText(newPassword)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard недоступен — пароль всё равно виден в поле */
    }
  }

  const name = data?.full_name || seedName
  const avatar = avatarOverride ?? data?.avatar_url ?? seedAvatar
  const balance = data?.balance_rub ?? 0
  const lessonsYear = data?.lessons_this_year ?? 0
  const lecturesCount = data?.lectures_count ?? 0
  const bio = data?.bio_content
  const bioAuthor = data?.bio_author_name
  // A1..C2 → 1..6 огоньков закрашено по уровню английского. english_level в
  // БД хранит roast-строку ("Raw", "Rare", "Medium Rare", ...) — сначала
  // конвертим в CEFR (fromRoastLevel), затем считаем позицию 1..6.
  const CEFR = ["A1","A2","B1","B2","C1","C2"] as const
  const cefr = fromRoastLevel(data?.english_level)
  const litCount = Math.max(0, Math.min(6, (CEFR as readonly string[]).indexOf(cefr) + 1))

  return (
    <div className="asm-backdrop" onClick={onClose}>
      <link rel="stylesheet" href="/dashboard/admin-student-modal.css?v=20260911-pass" />
      {/* Figma 2522:106 (Group 358): фото и контакты слева, имя / комментарий / статы / баланс / кнопка справа */}
      <div className="asm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <button type="button" className="asm-close" aria-label="Закрыть" onClick={onClose}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/ic-close-lime.svg" alt="" aria-hidden />
        </button>

        <div className="asm-photo">
          <Avatar name={name} src={avatar ?? undefined} />
          <button
            type="button"
            className="asm-photo-cam"
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            aria-label={avatarUploading ? "Загружаем…" : "Изменить фото ученика"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dashboard/ic-camera-dark.svg" alt="" aria-hidden width={34.69} height={27.35} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
        {uploadError && <div className="asm-upload-err">{uploadError}</div>}

        <div className="asm-flames" aria-label={`Уровень ${cefr}`}>
          {Array.from({ length: 6 }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              className="asm-flame"
              src={i < litCount ? "/dashboard/student/flame/filled.svg" : "/dashboard/student/flame/empty.svg"}
              alt=""
              width={22.5}
              height={30}
            />
          ))}
        </div>

        <div className="asm-field asm-field--mail">
          <div className="asm-contact-label">почта</div>
          <div className="asm-contact-val" title={data?.email || undefined}>{data?.email || "–"}</div>
        </div>
        <div className="asm-field asm-field--phone">
          <div className="asm-contact-label">телефон</div>
          <div className="asm-contact-val">{data?.phone || "–"}</div>
        </div>
        <div className="asm-field asm-field--pass">
          <div className="asm-contact-label">пароль</div>
          {resetState === "done" && newPassword ? (
            <div className="asm-pass-row">
              <code className="asm-pass-val" title="Новый пароль — показан один раз">{newPassword}</code>
              <button type="button" className="asm-pass-copy" onClick={copyPassword} aria-label="Скопировать пароль">
                {copied ? "скопировано" : "копировать"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="asm-pass-reset"
              onClick={resetPassword}
              disabled={resetState === "busy"}
            >
              {resetState === "busy" ? "Сбрасываем…" : resetState === "error" ? "Ошибка, попробовать ещё раз" : "Сбросить пароль"}
            </button>
          )}
        </div>

        <h2 className="asm-name">{name}</h2>
        <div className="asm-bio-label">Последний комментарий об ученике</div>
        {bio ? (
          <div className="asm-bio" title={bio}>{bio}</div>
        ) : (
          <div className="asm-bio asm-bio--empty">Учитель ещё не оставил комментарий.</div>
        )}
        {bio && bioAuthor && <div className="asm-bio-author">{bioAuthor}</div>}

        <div className="asm-stat asm-stat--year">
          <div className="asm-stat-num">{lessonsYear}</div>
          <div className="asm-stat-label">количество<br />занятий с начала года</div>
        </div>
        <div className="asm-stat asm-stat--lectures">
          <div className="asm-stat-num">{lecturesCount}</div>
          <div className="asm-stat-label">количество<br />лекций</div>
        </div>

        <div className="asm-balance-pill" aria-label={`Баланс: ${balance} ${pluralize(balance, "рубль", "рубля", "рублей")}`}>
          <span className="asm-balance-cap">баланс:</span>
          <span className="asm-balance-num">{balance.toLocaleString("ru-RU").replace(/\u00a0/g, ".")}</span>
          <span className="asm-balance-unit">{pluralize(balance, "рубль", "рубля", "рублей")}</span>
        </div>

        <button type="button" className="asm-btn asm-btn--schedule" onClick={() => onOpenSchedule(studentId)}>
          Открыть расписание
        </button>
      </div>
    </div>
  )
}
