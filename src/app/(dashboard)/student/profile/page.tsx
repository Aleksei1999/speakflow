"use client"

import "@/styles/dashboard/student-profile.css"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types — aligned with GET /api/profile/me
// ─────────────────────────────────────────────────────────────────────────────

type ProfileData = {
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    timezone: string | null
    created_at: string
    balance_rub: number
    subscription_tier: "free" | "pro"
    subscription_until: string | null
    city: string | null
    occupation: string | null
    english_goal: string | null
    interests: string[]
  }
  progress: {
    total_xp: number
    current_streak: number
    longest_streak: number
    lessons_completed: number
    english_level: string | null
    level_index: number
    level_name: string
    next_level_name: string
    level_progress_pct: number
    xp_to_next: number
    next_threshold: number
  }
  stats: {
    platform_days: number
    lessons_completed: number
    clubs_attended: number
    hours_total: number
    total_xp: number
    achievements_earned: number
  }
  journey: Array<{
    key: string
    date: string | null
    title: string
    desc: string
    kind: "done" | "active" | "future"
  }>
  favorite_teacher: {
    id: string
    full_name: string | null
    avatar_url: string | null
    specialization: string | null
    native_language: string | null
    country: string | null
    lessons_count: number
    rating: number | null
  } | null
  history: Array<{
    id: string
    date: string
    title: string
    amount: number
    kind: "debit" | "credit" | "xp"
    currency: string
    status: "ok" | "pending"
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — scoped to .profile-page, theme-aware via dashboard-shell vars.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function initial(name: string | null | undefined, email?: string | null): string {
  const s = (name ?? "").trim()
  if (s) return s.charAt(0).toUpperCase()
  const e = (email ?? "").trim()
  return e ? e.charAt(0).toUpperCase() : "?"
}

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n)
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
const MONTHS_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

function formatDate(iso: string | null, mode: "short" | "full" = "short"): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const day = d.getDate()
  const month = mode === "full" ? MONTHS_FULL[d.getMonth()] : MONTHS_SHORT[d.getMonth()]
  const year = d.getFullYear()
  const now = new Date()
  return mode === "full" && year !== now.getFullYear() ? `${day} ${month} ${year}` : `${day} ${month}`
}

function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1]
  return forms[2]
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const loadProfile = async () => {
    const res = await fetch("/api/profile/me", { cache: "no-store" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error ?? "Не удалось загрузить профиль")
    }
    return (await res.json()) as ProfileData
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const json = await loadProfile()
        if (!cancelled) setData(json)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Ошибка загрузки")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleEditSaved = async () => {
    try {
      const fresh = await loadProfile()
      setData(fresh)
    } catch {
      /* keep old state */
    }
  }

  const streakGoalPct = useMemo(() => {
    if (!data) return 0
    return Math.min(100, Math.round(((data.progress.current_streak ?? 0) / 30) * 100))
  }, [data])

  const clubsGoalPct = useMemo(() => {
    if (!data) return 0
    return Math.min(100, Math.round(((data.stats.clubs_attended ?? 0) / 25) * 100))
  }, [data])

  if (loading) {
    return (
      <>
        <div className="profile-page">
          <div className="prof-loading">Загружаем профиль…</div>
        </div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <div className="profile-page">
          <div className="prof-error">{error ?? "Профиль недоступен"}</div>
        </div>
      </>
    )
  }

  const { profile, progress, stats, journey, favorite_teacher } = data
  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Без имени"
  const isPro = profile.subscription_tier === "pro"

  const contactLine = [profile.email, profile.phone].filter(Boolean).join(" · ")

  return (
    <>
      <div className="profile-page">
        {/* HERO */}
        <div className="prof-hero">
          <div className="prof-ava">
            {profile.avatar_url ? <img src={profile.avatar_url} alt={displayName} /> : initial(displayName, profile.email)}
          </div>
          <div className="prof-info">
            <div className="prof-name">{displayName}</div>
            <div className="prof-email">{contactLine}</div>
            <div className="prof-badges">
              <span className="prof-badge pb--level">🔥 {progress.level_name}{progress.english_level ? ` · ${progress.english_level}` : ""}</span>
              {progress.current_streak > 0 && (
                // Подпись «текущий» отделяет это число от соседнего «N дней
                // на платформе» в карточке статистики — иначе пользователи
                // путают streak и общее время в проекте.
                <span className="prof-badge pb--streak">⚡ {progress.current_streak}-day streak (текущий)</span>
              )}
              {isPro && <span className="prof-badge pb--sub">👑 Pro Member</span>}
            </div>
          </div>
          <button className="prof-edit" type="button" onClick={() => setEditOpen(true)}>
            Редактировать
          </button>
        </div>

        {/* STATS */}
        <div className="p-stats">
          <div className="ps">
            <div className="ps-icon">📅</div>
            <div>
              <div className="ps-val">{stats.platform_days} {plural(stats.platform_days, ["день", "дня", "дней"])}</div>
              {/* Уточняем что это не streak — пользователи путают эти два числа. */}
              <div className="ps-label">Дней на платформе</div>
            </div>
          </div>
          <div className="ps">
            <div className="ps-icon">📚</div>
            <div>
              <div className="ps-val">{stats.lessons_completed}</div>
              <div className="ps-label">Уроков пройдено</div>
            </div>
          </div>
          <div className="ps">
            <div className="ps-icon">🎙</div>
            <div>
              <div className="ps-val">{stats.clubs_attended}</div>
              <div className="ps-label">Клубов посещено</div>
            </div>
          </div>
          <div className="ps">
            <div className="ps-icon">⏱</div>
            <div>
              <div className="ps-val">{stats.hours_total} {plural(Math.round(stats.hours_total), ["час", "часа", "часов"])}</div>
              <div className="ps-label">Время на англ.</div>
            </div>
          </div>
          <div className="ps">
            <div className="ps-icon">⚡</div>
            <div>
              <div className="ps-val ps-val--red">{formatRub(stats.total_xp)} XP</div>
              <div className="ps-label">Всего XP</div>
            </div>
          </div>
          <div className="ps">
            <div className="ps-icon">🏆</div>
            <div>
              <div className="ps-val">{stats.achievements_earned}</div>
              <div className="ps-label">Ачивок</div>
            </div>
          </div>
        </div>

        {/* JOURNEY + ABOUT */}
        <div className="two-col">
          {/* Journey */}
          <div className="card">
            <div className="card-head">
              <h3>Мой путь прожарки</h3>
            </div>
            <div className="card-body">
              <div className="journey">
                {journey.map((item, idx) => {
                  const isLast = idx === journey.length - 1
                  const showDoneLine = !isLast && item.kind === "done"
                  const dotCls =
                    item.kind === "done" ? "j-dot--done" : item.kind === "active" ? "j-dot--active" : "j-dot--future"
                  const lineCls = showDoneLine ? "j-line--done" : ""
                  const itemCls = item.kind === "future" ? "j-item j-item--future" : "j-item"
                  return (
                    <div key={item.key} className={itemCls}>
                      <div className={`j-dot ${dotCls}`} />
                      {!isLast && <div className={`j-line ${lineCls}`} />}
                      <div className="j-content">
                        <div className="j-date">
                          {item.kind === "active" ? "Сейчас" : item.date ? formatDate(item.date, "full") : "—"}
                        </div>
                        <div className="j-title">{item.title}</div>
                        <div className="j-desc">{item.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* About / Goals / Favorite teacher */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-head">
                <h3>О себе</h3>
                <button className="card-edit" type="button" onClick={() => setEditOpen(true)}>
                  ✏️
                </button>
              </div>
              <div className="card-body">
                <div className="about-field">
                  <div className="af-label">Город</div>
                  <div className={profile.city ? "af-val" : "af-val af-val--empty"}>
                    {profile.city || "Не указан"}
                  </div>
                </div>
                <div className="about-field">
                  <div className="af-label">Профессия</div>
                  <div className={profile.occupation ? "af-val" : "af-val af-val--empty"}>
                    {profile.occupation || "Не указана"}
                  </div>
                </div>
                <div className="about-field">
                  <div className="af-label">Зачем учу английский</div>
                  <div className={profile.english_goal ? "af-val" : "af-val af-val--empty"}>
                    {profile.english_goal || "Цель пока не указана"}
                  </div>
                </div>
                <div className="about-field">
                  <div className="af-label">Любимые темы для разговора</div>
                  {profile.interests && profile.interests.length > 0 ? (
                    <div className="af-tags">
                      {profile.interests.map((t) => (
                        <span key={t} className="af-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="af-val af-val--empty">Пока пусто — расскажите о себе в «Редактировать»</div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Мои цели</h3>
              </div>
              <div className="card-body">
                <div className="goal">
                  <div className="goal-top">
                    <div className="goal-name">Достичь {progress.next_level_name}</div>
                    <div className="goal-pct">{progress.level_progress_pct}%</div>
                  </div>
                  <div className="goal-bar">
                    <div className="goal-fill" style={{ width: `${progress.level_progress_pct}%` }} />
                  </div>
                </div>
                <div className="goal">
                  <div className="goal-top">
                    <div className="goal-name">30-дневный стрик</div>
                    <div className="goal-pct">{streakGoalPct}%</div>
                  </div>
                  <div className="goal-bar">
                    <div className="goal-fill goal-fill--lime" style={{ width: `${streakGoalPct}%` }} />
                  </div>
                </div>
                <div className="goal">
                  <div className="goal-top">
                    <div className="goal-name">Посетить 25 клубов</div>
                    <div className="goal-pct">{clubsGoalPct}%</div>
                  </div>
                  <div className="goal-bar">
                    <div className="goal-fill" style={{ width: `${clubsGoalPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Мой преподаватель</h3>
              </div>
              <div className="card-body">
                {favorite_teacher ? (
                  <div className="fav-teacher">
                    <div className="fav-ava">
                      {favorite_teacher.avatar_url ? (
                        <img src={favorite_teacher.avatar_url} alt={favorite_teacher.full_name ?? "teacher"} />
                      ) : (
                        initial(favorite_teacher.full_name)
                      )}
                    </div>
                    <div className="fav-info">
                      <div className="fav-name">{favorite_teacher.full_name || "Преподаватель"}</div>
                      <div className="fav-role">
                        {[
                          favorite_teacher.specialization,
                          favorite_teacher.native_language,
                          favorite_teacher.country,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Профиль преподавателя"}
                      </div>
                      <div className="fav-stats">
                        {favorite_teacher.lessons_count} {plural(favorite_teacher.lessons_count, ["урок", "урока", "уроков"])} пройдено
                        {favorite_teacher.rating ? ` · ★ ${favorite_teacher.rating.toFixed(1)}` : ""}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="fav-empty">Пока не занимался с одним преподавателем регулярно</div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      {editOpen && (
        <EditAboutModal
          initial={profile}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false)
            await handleEditSaved()
          }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit "О себе" modal — updates first_name/last_name/phone/city/occupation/
// english_goal/interests via PATCH /api/profile/me
// ─────────────────────────────────────────────────────────────────────────────

type EditInitial = ProfileData["profile"]

function EditAboutModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditInitial
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [firstName, setFirstName] = useState(initial.first_name ?? "")
  const [lastName, setLastName] = useState(initial.last_name ?? "")
  const [phone, setPhone] = useState(initial.phone ?? "")
  const [city, setCity] = useState(initial.city ?? "")
  const [occupation, setOccupation] = useState(initial.occupation ?? "")
  const [englishGoal, setEnglishGoal] = useState(initial.english_goal ?? "")
  const [interests, setInterests] = useState<string[]>(initial.interests ?? [])
  const [tagDraft, setTagDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const addTag = () => {
    const raw = tagDraft.trim()
    if (!raw) return
    if (interests.length >= 12) {
      toast.error("Можно добавить до 12 тем")
      return
    }
    if (raw.length > 40) {
      toast.error("Тема слишком длинная (макс 40 символов)")
      return
    }
    if (interests.some((t) => t.toLowerCase() === raw.toLowerCase())) {
      setTagDraft("")
      return
    }
    setInterests((prev) => [...prev, raw])
    setTagDraft("")
  }

  const removeTag = (t: string) => {
    setInterests((prev) => prev.filter((x) => x !== t))
  }

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error("Имя обязательно")
      return
    }
    setSaving(true)
    try {
      const body = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        city: city.trim() || null,
        occupation: occupation.trim() || null,
        english_goal: englishGoal.trim() || null,
        interests,
      }
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody?.error ?? "Не удалось сохранить")
      }
      toast.success("Профиль обновлён")
      await onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="pe-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="pe-modal">
        <div className="pe-head">
          <div className="pe-title">Редактировать профиль</div>
          <button className="pe-close" type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="pe-field">
            <label className="pe-label">Имя *</label>
            <input className="pe-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} />
          </div>
          <div className="pe-field">
            <label className="pe-label">Фамилия</label>
            <input className="pe-input" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} />
          </div>
        </div>

        <div className="pe-field">
          <label className="pe-label">Телефон</label>
          <input
            className="pe-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 (999) 123-45-67"
            maxLength={60}
          />
        </div>

        <div className="pe-field">
          <label className="pe-label">Город</label>
          <input
            className="pe-input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Москва, Россия"
            maxLength={120}
          />
        </div>

        <div className="pe-field">
          <label className="pe-label">Профессия</label>
          <input
            className="pe-input"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="UX-дизайнер"
            maxLength={120}
          />
        </div>

        <div className="pe-field">
          <label className="pe-label">Зачем учу английский</label>
          <textarea
            className="pe-textarea"
            value={englishGoal}
            onChange={(e) => setEnglishGoal(e.target.value)}
            placeholder="Работа в международной компании, путешествия, сериалы…"
            maxLength={500}
          />
          <div className="pe-hint">До 500 символов</div>
        </div>

        <div className="pe-field">
          <label className="pe-label">Любимые темы для разговора</label>
          <div className="pe-tags">
            {interests.map((t) => (
              <span key={t} className="pe-tag">
                {t}
                <button className="pe-tag-x" type="button" onClick={() => removeTag(t)} aria-label={`Удалить ${t}`}>
                  ✕
                </button>
              </span>
            ))}
            <input
              className="pe-tag-input"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addTag()
                }
                if (e.key === "Backspace" && !tagDraft && interests.length > 0) {
                  e.preventDefault()
                  setInterests((prev) => prev.slice(0, -1))
                }
              }}
              onBlur={() => tagDraft.trim() && addTag()}
              placeholder={interests.length === 0 ? "Добавь тему и нажми Enter" : "+ ещё"}
            />
          </div>
          <div className="pe-hint">Нажми Enter или запятую, чтобы добавить. До 12 тем.</div>
        </div>

        <div className="pe-actions">
          <button className="pe-btn pe-btn--ghost" type="button" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button className="pe-btn pe-btn--primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}
