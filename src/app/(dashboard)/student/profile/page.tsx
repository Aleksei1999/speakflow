"use client"

import { useEffect, useMemo, useState } from "react"

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

/* Balance card */
.bal-card{background:#0A0A0A;border-radius:20px;padding:28px;margin-bottom:24px;position:relative;overflow:hidden;color:#fff}
.bal-card::before{content:'';position:absolute;top:-60%;right:-30%;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(230,57,70,.08),transparent 70%);pointer-events:none}
.bal-card::after{content:'';position:absolute;bottom:-40%;left:-20%;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(216,242,106,.05),transparent 70%);pointer-events:none}
.bal-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1}
.bal-label{font-size:.65rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px}
.bal-amount{font-size:2.5rem;font-weight:800;letter-spacing:-1.5px;line-height:1;position:relative;z-index:1}
.bal-amount span{font-size:1.2rem;font-weight:600;color:rgba(255,255,255,.5)}
.bal-sub{font-size:.72rem;color:rgba(255,255,255,.45);margin-top:6px;position:relative;z-index:1}
.bal-actions{display:flex;gap:8px;margin-top:18px;position:relative;z-index:1}
.bal-btn{padding:10px 24px;border-radius:12px;font-size:.85rem;font-weight:700;border:none;transition:all .2s;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit}
.bal-btn--primary{background:var(--red);color:#fff;box-shadow:0 3px 0 rgba(180,30,45,.4)}
.bal-btn--primary:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.4),0 10px 20px rgba(230,57,70,.15)}
.bal-btn--ghost{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
.bal-btn--ghost:hover{background:rgba(255,255,255,.1);color:#fff}

/* Sections */
.section-title{font-size:1.1rem;font-weight:800;letter-spacing:-.3px;margin-bottom:4px}
.section-sub{font-size:.78rem;color:var(--muted);margin-bottom:16px}

/* Top-up tiers */
.topup-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px}
.topup{background:var(--surface);border:2px solid var(--border);border-radius:18px;padding:20px 16px;text-align:center;position:relative;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer}
.topup:hover{transform:translateY(-4px);border-color:var(--red);box-shadow:0 10px 30px var(--shadow)}
.topup--popular{border-color:var(--red)}
.topup--popular::before{content:'ПОПУЛЯРНЫЙ';position:absolute;top:0;left:0;right:0;padding:4px;background:var(--red);color:#fff;font-size:.52rem;font-weight:700;letter-spacing:1px;text-align:center}
.topup--popular .topup-body{padding-top:12px}
.topup--best{border-color:var(--lime)}
.topup--best::before{content:'ЛУЧШАЯ ЦЕНА';position:absolute;top:0;left:0;right:0;padding:4px;background:var(--lime);color:#0A0A0A;font-size:.52rem;font-weight:700;letter-spacing:1px;text-align:center}
.topup--best .topup-body{padding-top:12px}
.topup-amount{font-size:1.8rem;font-weight:800;letter-spacing:-1px;margin-bottom:2px}
.topup-lessons{margin-top:10px;padding:6px 12px;border-radius:8px;background:var(--bg);font-size:.68rem;font-weight:700;display:inline-block}
.topup-lessons b{color:var(--red)}
.topup-bonus{margin-top:8px;font-size:.65rem;font-weight:700;color:var(--lime-dark);padding:4px 10px;border-radius:6px;background:color-mix(in srgb,var(--lime) 15%,transparent);display:inline-block}
[data-theme="dark"] .topup-bonus{color:var(--lime)}
.topup-save{margin-top:6px;font-size:.6rem;color:var(--red);font-weight:700}
.topup-perprice{margin-top:6px;font-size:.58rem;color:var(--muted)}
.topup-btn{margin-top:12px;width:100%;padding:10px;border-radius:10px;border:none;font-size:.78rem;font-weight:700;transition:all .15s;cursor:pointer;font-family:inherit}
.topup-btn--default{background:var(--bg);color:var(--text)}.topup-btn--default:hover{background:#0A0A0A;color:#fff}
[data-theme="dark"] .topup-btn--default:hover{background:var(--lime);color:#0A0A0A}
.topup-btn--red{background:var(--red);color:#fff;box-shadow:0 2px 0 rgba(180,30,45,.3)}.topup-btn--red:hover{filter:brightness(.9)}
.topup-btn--lime{background:var(--lime);color:#0A0A0A;box-shadow:0 2px 0 rgba(140,180,40,.3)}.topup-btn--lime:hover{filter:brightness(.95)}

/* Subscription */
.sub-section{margin-bottom:32px}
.sub-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sub-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;position:relative;overflow:hidden}
.sub-card--pro{border-color:var(--red);box-shadow:0 2px 0 color-mix(in srgb,var(--red) 15%,transparent),0 10px 30px var(--shadow)}
.sub-card--pro::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime))}
.sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.sub-name{font-size:1rem;font-weight:800}
.sub-name .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.sub-price{text-align:right}
.sub-price-val{font-size:1.3rem;font-weight:800;letter-spacing:-.5px}
.sub-price-per{font-size:.62rem;color:var(--muted)}
.sub-price--free{color:var(--muted)}
.sub-features{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.sf{display:flex;align-items:flex-start;gap:8px;font-size:.78rem}
.sf-icon{width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;margin-top:1px}
.sf-icon--yes{background:var(--lime);color:#0A0A0A;font-weight:800}
.sf-icon--no{background:var(--bg);color:var(--muted)}
.sf-text{flex:1;line-height:1.4}
.sf-text--dim{color:var(--muted);text-decoration:line-through}
.sub-btn{width:100%;padding:12px;border-radius:12px;border:none;font-size:.88rem;font-weight:700;transition:all .2s;cursor:pointer;font-family:inherit}
.sub-btn--upgrade{background:var(--red);color:#fff;box-shadow:0 3px 0 rgba(180,30,45,.35)}.sub-btn--upgrade:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.35),0 10px 20px rgba(230,57,70,.1)}
.sub-btn--current{background:var(--bg);color:var(--muted);cursor:default}
.sub-warning{margin-top:16px;padding:14px 18px;border-radius:14px;background:color-mix(in srgb,var(--red) 4%,transparent);border:1px solid color-mix(in srgb,var(--red) 8%,transparent);display:flex;align-items:flex-start;gap:10px}
.sub-warning-icon{font-size:1.1rem;flex-shrink:0;margin-top:2px}
.sub-warning-text{font-size:.75rem;color:var(--text);line-height:1.5}
.sub-warning-text b{color:var(--red)}

/* History */
.history{background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;margin-bottom:28px}
.history-head{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.history-head h3{font-size:.95rem;font-weight:800}
.h-row{display:grid;grid-template-columns:100px 1fr 120px 110px;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid var(--border);font-size:.78rem}
.h-row:last-child{border-bottom:none}
.h-row:hover{background:var(--surface-2)}
.h-head{font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.h-date{color:var(--muted);font-size:.72rem}
.h-desc{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h-amount{text-align:right;font-weight:700}
.h-amount--plus{color:var(--green)}
.h-amount--minus{color:var(--red)}
.h-status{text-align:right}
.h-badge{padding:3px 8px;border-radius:6px;font-size:.6rem;font-weight:700}
.h-badge--ok{background:color-mix(in srgb,var(--green) 10%,transparent);color:var(--green)}
.h-badge--pending{background:color-mix(in srgb,var(--gold) 10%,transparent);color:var(--gold)}
.h-empty{padding:32px 20px;text-align:center;color:var(--muted);font-size:.85rem}

.prof-loading,.prof-error{padding:60px 20px;text-align:center;color:var(--muted);font-size:.95rem}
.prof-error{color:var(--red)}

@media(max-width:900px){
  .p-stats{grid-template-columns:repeat(3,1fr)}
  .two-col{grid-template-columns:1fr}
  .topup-grid{grid-template-columns:1fr 1fr}
  .sub-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .p-stats{grid-template-columns:repeat(2,1fr)}
  .prof-hero{flex-direction:column;text-align:center}
  .prof-badges{justify-content:center}
  .bal-amount{font-size:2rem}
  .h-row{grid-template-columns:80px 1fr 90px}
  .h-status{display:none}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Top-up tiers (config — RUB amounts align with Yookassa-friendly tiers)
// ─────────────────────────────────────────────────────────────────────────────

type TopupTier = {
  amount: number
  lessons: number
  bonus: string | null
  save: string | null
  perPrice: number
  badge: "default" | "popular" | "best"
  btnLabel: string
  btnVariant: "default" | "red" | "lime"
}

const TOPUP_TIERS: TopupTier[] = [
  { amount: 5400, lessons: 3, bonus: null, save: null, perPrice: 1800, badge: "default", btnLabel: "Пополнить", btnVariant: "default" },
  { amount: 9000, lessons: 6, bonus: "+1 урок бесплатно", save: "Экономия 1 800 ₽", perPrice: 1286, badge: "popular", btnLabel: "Пополнить", btnVariant: "red" },
  { amount: 18000, lessons: 13, bonus: "+3 урока бесплатно", save: "Экономия 5 400 ₽", perPrice: 1125, badge: "best", btnLabel: "Лучшая цена", btnVariant: "lime" },
  { amount: 36000, lessons: 28, bonus: "+8 уроков бесплатно", save: "Экономия 14 400 ₽", perPrice: 1000, badge: "default", btnLabel: "Пополнить", btnVariant: "default" },
]

const PRO_FEATURES_YES = [
  "Уроки 1-on-1 с преподавателями (с баланса)",
  "Тест уровня прожарки",
  "Расширенный профиль",
  "**Speaking Clubs** — безлимитно",
  "**Debate & Wine Clubs**",
  "**Геймификация:** XP, стрики, 6 уровней прожарки",
  "**37 ачивок** с реальными призами (мерч, скидки)",
  "**Лидерборд** — соревнуйся, побеждай, получай подарки",
  "**AI-персонализация** и план обучения",
  "**Персональные видео-уроки** после каждого занятия",
  "**Guest Pass** — приведи друга бесплатно",
  "**Чат коммьюнити** 24/7",
]

const FREE_FEATURES: Array<{ text: string; yes: boolean }> = [
  { text: "Уроки 1-on-1 с преподавателями (с баланса)", yes: true },
  { text: "Тест уровня прожарки", yes: true },
  { text: "Базовый профиль", yes: true },
  { text: "Speaking Clubs", yes: false },
  { text: "Debate & Wine Clubs", yes: false },
  { text: "Геймификация: XP, стрики, уровни", yes: false },
  { text: "Ачивки и призы", yes: false },
  { text: "Лидерборд", yes: false },
  { text: "AI-персонализация и план обучения", yes: false },
  { text: "Персональные видео-уроки", yes: false },
  { text: "Guest Pass для друга", yes: false },
  { text: "Чат коммьюнити 24/7", yes: false },
]

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

function renderBold(text: string): React.ReactNode[] {
  // Replaces **word** chunks with <b>word</b>
  const parts = text.split(/\*\*/)
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/profile/me", { cache: "no-store" })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? "Не удалось загрузить профиль")
        }
        const json = (await res.json()) as ProfileData
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

  const streakGoalPct = useMemo(() => {
    if (!data) return 0
    return Math.min(100, Math.round(((data.progress.current_streak ?? 0) / 30) * 100))
  }, [data])

  const clubsGoalPct = useMemo(() => {
    if (!data) return 0
    return Math.min(100, Math.round(((data.stats.clubs_attended ?? 0) / 25) * 100))
  }, [data])

  const handleTopup = (amount: number) => {
    // TODO: wire Yookassa create-payment flow with purpose='topup'
    window.alert(`Пополнение на ${formatRub(amount)} ₽ скоро будет доступно. Мы уже прикручиваем Yookassa.`)
  }

  const handleUpgrade = () => {
    window.alert("Подписка Raw Pro скоро будет доступна. Мы уже прикручиваем Yookassa.")
  }

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

  const { profile, progress, stats, journey, favorite_teacher, history } = data
  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Без имени"
  const isPro = profile.subscription_tier === "pro"

  const contactLine = [profile.email, profile.phone].filter(Boolean).join(" · ")

  const balanceSubParts: string[] = []
  const lessonsFromBalance = Math.floor((profile.balance_rub ?? 0) / 1800)
  if (lessonsFromBalance > 0) {
    balanceSubParts.push(`≈ ${lessonsFromBalance} ${plural(lessonsFromBalance, ["урок", "урока", "уроков"])} по 1 800 ₽`)
  } else {
    balanceSubParts.push("Пополните, чтобы оплачивать уроки")
  }
  if (isPro && profile.subscription_until) {
    balanceSubParts.push(`Подписка активна до ${formatDate(profile.subscription_until, "full")}`)
  }

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
          <button className="prof-edit" type="button" onClick={() => window.alert("Редактирование профиля скоро появится.")}>
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
                <button className="card-edit" type="button" onClick={() => window.alert("Редактирование профиля скоро появится.")}>
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

        {/* BALANCE */}
        <div className="bal-card">
          <div className="bal-top">
            <div className="bal-label">Баланс</div>
          </div>
          <div className="bal-amount">
            {formatRub(profile.balance_rub ?? 0)} <span>₽</span>
          </div>
          <div className="bal-sub">{balanceSubParts.join(" · ")}</div>
          <div className="bal-actions">
            <button
              className="bal-btn bal-btn--primary"
              type="button"
              onClick={() => document.getElementById("topup")?.scrollIntoView({ behavior: "smooth" })}
            >
              Пополнить баланс
            </button>
            <button
              className="bal-btn bal-btn--ghost"
              type="button"
              onClick={() => document.getElementById("history")?.scrollIntoView({ behavior: "smooth" })}
            >
              История платежей
            </button>
          </div>
        </div>

        {/* TOPUP */}
        <div id="topup">
          <div className="section-title">Пополнить баланс</div>
          <div className="section-sub">
            Баланс используется для оплаты уроков и клубов. Чем больше пополняешь — тем выгоднее.
          </div>
        </div>

        <div className="topup-grid">
          {TOPUP_TIERS.map((t) => {
            const cls =
              t.badge === "popular" ? "topup topup--popular" : t.badge === "best" ? "topup topup--best" : "topup"
            const btnCls =
              t.btnVariant === "red" ? "topup-btn topup-btn--red" : t.btnVariant === "lime" ? "topup-btn topup-btn--lime" : "topup-btn topup-btn--default"
            return (
              <div key={t.amount} className={cls} onClick={() => handleTopup(t.amount)}>
                <div className="topup-body">
                  <div className="topup-amount">{formatRub(t.amount)} ₽</div>
                  <div className="topup-lessons">
                    ≈ <b>{t.lessons}</b> {plural(t.lessons, ["урок", "урока", "уроков"])}
                  </div>
                  {t.bonus && <div className="topup-bonus">{t.bonus}</div>}
                  {t.save && <div className="topup-save">{t.save}</div>}
                  <div className="topup-perprice">{formatRub(t.perPrice)} ₽ / урок</div>
                  <button
                    className={btnCls}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTopup(t.amount)
                    }}
                  >
                    {t.btnLabel}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* SUBSCRIPTION */}
        <div className="sub-section">
          <div className="section-title">Подписка на платформу</div>
          <div className="section-sub">
            Подписка открывает геймификацию, клубы, ачивки и призы. Уроки оплачиваются отдельно с баланса.
          </div>

          <div className="sub-grid">
            <div className="sub-card">
              <div className="sub-head">
                <div className="sub-name">Без подписки</div>
                <div className="sub-price">
                  <div className="sub-price-val sub-price--free">0 ₽</div>
                  <div className="sub-price-per">бесплатно</div>
                </div>
              </div>
              <div className="sub-features">
                {FREE_FEATURES.map((f, i) => (
                  <div key={i} className="sf">
                    <div className={f.yes ? "sf-icon sf-icon--yes" : "sf-icon sf-icon--no"}>{f.yes ? "✓" : "✗"}</div>
                    <div className={f.yes ? "sf-text" : "sf-text sf-text--dim"}>{f.text}</div>
                  </div>
                ))}
              </div>
              {!isPro ? (
                <button className="sub-btn sub-btn--current" type="button" disabled>
                  Текущий план
                </button>
              ) : (
                <button
                  className="sub-btn sub-btn--current"
                  type="button"
                  onClick={() => window.alert("Для отмены подписки напишите в поддержку.")}
                >
                  Перейти на бесплатный
                </button>
              )}
            </div>

            <div className="sub-card sub-card--pro">
              <div className="sub-head">
                <div className="sub-name">
                  <span className="gl">Raw</span> Pro
                </div>
                <div className="sub-price">
                  <div className="sub-price-val">1 490 ₽</div>
                  <div className="sub-price-per">/ месяц</div>
                </div>
              </div>
              <div className="sub-features">
                {PRO_FEATURES_YES.map((t, i) => (
                  <div key={i} className="sf">
                    <div className="sf-icon sf-icon--yes">✓</div>
                    <div className="sf-text">{renderBold(t)}</div>
                  </div>
                ))}
              </div>
              {isPro ? (
                <button className="sub-btn sub-btn--current" type="button" disabled>
                  Активна до {profile.subscription_until ? formatDate(profile.subscription_until, "full") : "—"}
                </button>
              ) : (
                <button className="sub-btn sub-btn--upgrade" type="button" onClick={handleUpgrade}>
                  Подключить Pro — 1 490 ₽/мес
                </button>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="sub-warning">
              <div className="sub-warning-icon">⚠️</div>
              <div className="sub-warning-text">
                <b>Без подписки</b> ты можешь только записываться на уроки с преподавателями. Speaking Clubs, геймификация, ачивки, призы, лидерборд, AI-план и коммьюнити — всё это <b>доступно только с подпиской Raw Pro</b>. Подписка не включает стоимость уроков — они оплачиваются отдельно с баланса.
              </div>
            </div>
          )}
        </div>

        {/* HISTORY */}
        <div className="history" id="history">
          <div className="history-head">
            <h3>История платежей</h3>
          </div>
          <div className="h-row h-head">
            <div>Дата</div>
            <div>Описание</div>
            <div style={{ textAlign: "right" }}>Сумма</div>
            <div style={{ textAlign: "right" }}>Статус</div>
          </div>
          {history.length === 0 ? (
            <div className="h-empty">История пока пуста</div>
          ) : (
            history.map((h) => {
              const isPlus = h.kind === "credit" || h.kind === "xp"
              const amountCls = isPlus ? "h-amount h-amount--plus" : "h-amount h-amount--minus"
              const sign = isPlus ? "+" : "−"
              const badgeCls = h.status === "ok" ? "h-badge h-badge--ok" : "h-badge h-badge--pending"
              const badgeText =
                h.status === "pending" ? "В ожидании" : h.kind === "credit" ? "Зачислено" : h.kind === "xp" ? "Начислено" : "Оплачено"
              const displayAmount =
                h.currency === "XP" ? `${sign}${formatRub(Math.abs(h.amount))} XP` : `${sign}${formatRub(Math.abs(h.amount))} ₽`
              return (
                <div className="h-row" key={h.id}>
                  <div className="h-date">{formatDate(h.date, "short")}</div>
                  <div className="h-desc">{h.title}</div>
                  <div className={amountCls}>{displayAmount}</div>
                  <div className="h-status">
                    <span className={badgeCls}>{badgeText}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
