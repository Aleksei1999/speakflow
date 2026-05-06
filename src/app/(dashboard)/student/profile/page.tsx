"use client"

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

const PROFILE_CSS = `
.profile-page{max-width:1000px;margin:0 auto;--gold:#B8960A;--green:#16a34a}
[data-theme="dark"] .profile-page{--gold:#FFD700;--green:#22c55e}
.profile-page *{box-sizing:border-box}

/* Hero */
.prof-hero{display:flex;gap:20px;align-items:center;margin-bottom:28px;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 2px 0 var(--border),0 6px 20px var(--shadow)}
.prof-ava{width:72px;height:72px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:800;color:#fff;flex-shrink:0;border:3px solid var(--lime);box-shadow:0 4px 0 color-mix(in srgb,var(--red) 25%,transparent);overflow:hidden}
.prof-ava img{width:100%;height:100%;object-fit:cover}
.prof-info{flex:1;min-width:0}
.prof-name{font-size:1.2rem;font-weight:800;letter-spacing:-.3px}
.prof-email{font-size:.78rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis}
.prof-badges{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.prof-badge{padding:4px 10px;border-radius:8px;font-size:.6rem;font-weight:700}
.pb--level{background:color-mix(in srgb,var(--red) 8%,transparent);color:var(--red)}
.pb--streak{background:color-mix(in srgb,var(--lime) 15%,transparent);color:var(--lime-dark)}
[data-theme="dark"] .pb--streak{color:var(--lime)}
.pb--sub{background:color-mix(in srgb,var(--gold) 10%,transparent);color:var(--gold)}
.prof-edit{padding:8px 18px;border-radius:10px;border:1px solid var(--border);font-size:.78rem;font-weight:600;color:var(--muted);background:transparent;cursor:pointer;transition:all .15s;font-family:inherit}
.prof-edit:hover{border-color:var(--text);color:var(--text)}

/* Stats grid */
.p-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:22px}
.ps{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;align-items:center;gap:10px;transition:all .15s}
.ps:hover{border-color:var(--text);transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow)}
.ps-icon{font-size:1.2rem;flex-shrink:0}
.ps-val{font-size:1rem;font-weight:800;letter-spacing:-.3px;line-height:1}
.ps-val--red{color:var(--red)}
.ps-label{font-size:.58rem;color:var(--muted);font-weight:600;margin-top:2px}

/* Two column */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}

/* Card */
.card{background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
.card-head h3{font-size:.92rem;font-weight:800}
.card-edit{font-size:.8rem;opacity:.5;transition:opacity .2s;background:none;border:none;cursor:pointer;color:inherit;font-family:inherit}
.card-edit:hover{opacity:1}
.card-body{padding:14px 18px}

/* Journey */
.journey{position:relative;padding-left:20px}
.j-item{position:relative;padding-bottom:20px;padding-left:16px}
.j-item:last-child{padding-bottom:0}
.j-dot{position:absolute;left:-20px;top:4px;width:12px;height:12px;border-radius:50%;border:2px solid var(--border);background:var(--surface);z-index:2}
.j-dot--done{background:var(--lime);border-color:var(--lime)}
.j-dot--active{background:var(--red);border-color:var(--red);box-shadow:0 0 0 4px color-mix(in srgb,var(--red) 12%,transparent);animation:profDotPulse 2s infinite}
@keyframes profDotPulse{0%,100%{box-shadow:0 0 0 4px color-mix(in srgb,var(--red) 12%,transparent)}50%{box-shadow:0 0 0 8px color-mix(in srgb,var(--red) 6%,transparent)}}
.j-dot--future{background:var(--bg);border-color:var(--border);border-style:dashed}
.j-line{position:absolute;left:-15px;top:16px;width:2px;height:calc(100% - 8px);background:var(--border)}
.j-line--done{background:var(--lime)}
.j-date{font-size:.6rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.j-title{font-size:.82rem;font-weight:700;margin-top:2px}
.j-desc{font-size:.7rem;color:var(--muted);margin-top:1px}
.j-item--future{opacity:.5}

/* About fields */
.about-field{padding:8px 0;border-bottom:1px solid var(--border)}
.about-field:last-child{border-bottom:none}
.af-label{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.af-val{font-size:.82rem;font-weight:600}
.af-val--empty{color:var(--muted);font-weight:500;font-style:italic}
.af-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.af-tag{padding:4px 10px;border-radius:8px;font-size:.65rem;font-weight:600;background:var(--bg);color:var(--text)}

/* Goals */
.goal{margin-bottom:12px}.goal:last-child{margin-bottom:0}
.goal-top{display:flex;justify-content:space-between;margin-bottom:4px}
.goal-name{font-size:.78rem;font-weight:700}
.goal-pct{font-size:.72rem;font-weight:700;color:var(--red)}
.goal-bar{height:5px;background:var(--border);border-radius:100px;overflow:hidden}
.goal-fill{height:100%;border-radius:100px;background:var(--red)}
.goal-fill--lime{background:var(--lime)}

/* Favorite teacher */
.fav-teacher{display:flex;align-items:center;gap:12px}
.fav-ava{width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--red) 8%,transparent);color:var(--red);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;flex-shrink:0;overflow:hidden}
.fav-ava img{width:100%;height:100%;object-fit:cover}
.fav-info{min-width:0}
.fav-name{font-size:.88rem;font-weight:700}
.fav-role{font-size:.68rem;color:var(--muted);margin-top:1px}
.fav-stats{font-size:.65rem;color:var(--lime-dark);font-weight:600;margin-top:3px}
[data-theme="dark"] .fav-stats{color:var(--lime)}
.fav-empty{font-size:.78rem;color:var(--muted);font-style:italic}

.prof-loading,.prof-error{padding:60px 20px;text-align:center;color:var(--muted);font-size:.95rem}
.prof-error{color:var(--red)}

/* Edit modal */
.pe-backdrop{position:fixed;inset:0;background:rgba(10,10,10,.55);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;backdrop-filter:blur(4px)}
.pe-modal{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.pe-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.pe-title{font-size:1.05rem;font-weight:800;letter-spacing:-.2px}
.pe-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:transparent;cursor:pointer;font-size:1rem;color:var(--muted);transition:all .15s;font-family:inherit}
.pe-close:hover{border-color:var(--text);color:var(--text)}
.pe-field{margin-bottom:14px}
.pe-label{font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:block}
.pe-input,.pe-textarea{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font-size:.85rem;font-weight:500;outline:none;transition:border-color .15s;font-family:inherit}
.pe-input:focus,.pe-textarea:focus{border-color:var(--red)}
.pe-textarea{resize:vertical;min-height:72px;line-height:1.4}
.pe-tags{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px dashed var(--border);border-radius:10px;background:var(--bg);min-height:42px}
.pe-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 8px 4px 10px;border-radius:8px;background:var(--surface);border:1px solid var(--border);font-size:.72rem;font-weight:600}
.pe-tag-x{background:transparent;border:none;cursor:pointer;font-size:.85rem;line-height:1;color:var(--muted);padding:0 2px;font-family:inherit}
.pe-tag-x:hover{color:var(--red)}
.pe-tag-input{flex:1;min-width:120px;border:none;background:transparent;outline:none;font-size:.78rem;padding:4px;color:var(--text);font-family:inherit}
.pe-hint{font-size:.65rem;color:var(--muted);margin-top:4px}
.pe-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.pe-btn{padding:10px 20px;border-radius:10px;font-size:.82rem;font-weight:700;transition:all .15s;cursor:pointer;border:none;font-family:inherit}
.pe-btn--ghost{background:transparent;color:var(--muted);border:1px solid var(--border)}
.pe-btn--ghost:hover{color:var(--text);border-color:var(--text)}
.pe-btn--primary{background:var(--red);color:#fff;box-shadow:0 2px 0 color-mix(in srgb,var(--red) 40%,#000)}
.pe-btn--primary:hover:not(:disabled){filter:brightness(.92)}
.pe-btn--primary:disabled{opacity:.5;cursor:not-allowed}

@media(max-width:900px){
  .p-stats{grid-template-columns:repeat(3,1fr)}
  .two-col{grid-template-columns:1fr}
}
@media(max-width:600px){
  .p-stats{grid-template-columns:repeat(2,1fr)}
  .prof-hero{flex-direction:column;text-align:center}
  .prof-badges{justify-content:center}
}
`

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
        <style dangerouslySetInnerHTML={{ __html: PROFILE_CSS }} />
        <div className="profile-page">
          <div className="prof-loading">Загружаем профиль…</div>
        </div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PROFILE_CSS }} />
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
      <style dangerouslySetInnerHTML={{ __html: PROFILE_CSS }} />
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
                <span className="prof-badge pb--streak">⚡ {progress.current_streak}-day streak</span>
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
              <div className="ps-label">На платформе</div>
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
