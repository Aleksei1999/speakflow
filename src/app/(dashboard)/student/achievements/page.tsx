"use client"

import "@/styles/dashboard/student-achievements.css"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror of /api/achievements and /api/rewards)
// ─────────────────────────────────────────────────────────────────────────────

type Rarity = "common" | "rare" | "epic" | "legendary"
type Category = "streak" | "speaking" | "levels" | "xp" | "community" | "special"
type RewardType = "none" | "digital" | "physical"

type Achievement = {
  id: string
  slug: string
  title: string
  description: string
  category: Category
  rarity: Rarity
  icon_emoji: string | null
  threshold: number
  xp_reward: number
  reward_type: RewardType
  reward_label: string | null
  sort_order: number
  current_value: number
  is_earned: boolean
  earned_at: string | null
  is_claimable: boolean
}

type Reward = {
  id: string
  slug: string
  title: string
  description: string | null
  icon_emoji: string | null
  reward_type: "digital" | "physical"
  claim_criteria: any
  is_eligible: boolean
  already_claimed: boolean
  claimed_status: string | null
}

type CatKey = "all" | Category

const CATEGORY_ORDER: Category[] = [
  "streak",
  "speaking",
  "levels",
  "xp",
  "community",
  "special",
]

const CATEGORY_META: Record<Category, { emoji: string; name: string; tab: string }> = {
  streak: { emoji: "🔥", name: "Стрики и постоянство", tab: "🔥 Стрики" },
  speaking: { emoji: "🎙", name: "Speaking Clubs", tab: "🎙 Speaking" },
  levels: { emoji: "📈", name: "Уровни", tab: "📈 Уровни" },
  xp: { emoji: "⚡", name: "XP и активность", tab: "⚡ XP" },
  community: { emoji: "👥", name: "Комьюнити и друзья", tab: "👥 Комьюнити" },
  special: { emoji: "💎", name: "Специальные", tab: "💎 Специальные" },
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (ported from achievements-page.html, scoped to .achievements-page)
// Uses dashboard-shell CSS vars: --bg, --surface, --surface-2, --border,
// --muted, --text, --red, --lime, --shadow. Dark theme is handled by
// [data-theme="dark"] overrides at shell level — no duplicate palette here.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pluralizeAchievements(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "достижение"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "достижения"
  return "достижений"
}

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentAchievementsPage() {
  const t = useTranslations("dashboard.student.achievements")
  const CATEGORY_META_LOCALIZED: Record<Category, { emoji: string; name: string; tab: string }> = {
    streak: { emoji: "🔥", name: t("categoryStreakName"), tab: t("categoryStreakTab") },
    speaking: { emoji: "🎙", name: "Speaking Clubs", tab: "🎙 Speaking" },
    levels: { emoji: "📈", name: t("categoryLevelsName"), tab: t("categoryLevelsTab") },
    xp: { emoji: "⚡", name: "XP", tab: "⚡ XP" },
    community: { emoji: "👥", name: t("categoryCommunityName"), tab: t("categoryCommunityTab") },
    special: { emoji: "💎", name: t("categorySpecialName"), tab: t("categorySpecialTab") },
  }
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<CatKey>("all")
  const [claiming, setClaiming] = useState<Set<string>>(new Set())

  // Initial load
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [aRes, rRes] = await Promise.all([
          fetch("/api/achievements", { cache: "no-store" }),
          fetch("/api/rewards", { cache: "no-store" }),
        ])
        const aJson = aRes.ok ? await aRes.json() : { achievements: [] }
        const rJson = rRes.ok ? await rRes.json() : { rewards: [] }
        if (cancelled) return
        setAchievements(aJson.achievements ?? [])
        setRewards(rJson.rewards ?? [])
      } catch {
        // noop — empty state will be shown
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Hero stats
  // FIX HIGH-7: hero раньше считал только claim'нутые (is_earned),
  // и юзер видел «0/37», хотя карточки ниже уже горят «Забрать награду».
  // Считаем как разблокированные = is_earned OR is_claimable. «Призов
  // получено» отдельно — там реально только claimed.
  const stats = useMemo(() => {
    const total = achievements.length || 37
    const unlocked = achievements.filter(
      (a) => a.is_earned || (a as any).is_claimable
    )
    const earned = unlocked.length
    const xpEarned = unlocked.reduce(
      (sum, a) => sum + (a.xp_reward ?? 0),
      0
    )
    const rewardsEarned = rewards.filter((r) => r.already_claimed).length
    // Next = ещё не разблокирована, ближайшая по threshold.
    const next = achievements
      .filter(
        (a) => !a.is_earned && !(a as any).is_claimable && a.threshold > 0
      )
      .map((a) => ({ a, pct: Math.min(1, (a.current_value ?? 0) / a.threshold) }))
      .sort((x, y) => y.pct - x.pct)[0]?.a
    const pct = total > 0 ? Math.round((earned / total) * 100) : 0
    return { total, earned, xpEarned, rewardsEarned, next, pct }
  }, [achievements, rewards])

  // Filter by active tab
  const visibleAchievements = useMemo(() => {
    if (activeCat === "all") return achievements
    return achievements.filter((a) => a.category === activeCat)
  }, [achievements, activeCat])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<Category, Achievement[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const a of visibleAchievements) {
      const arr = map.get(a.category)
      if (arr) arr.push(a)
    }
    // Sort each group by sort_order then threshold
    for (const arr of map.values()) {
      arr.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0) || x.threshold - y.threshold)
    }
    return map
  }, [visibleAchievements])

  // XP ring dashoffset
  const ringCirc = 2 * Math.PI * 70 // r=70
  const ringOffset = ringCirc * (1 - stats.pct / 100)

  // Claim achievement reward (OPTIMISTIC):
  // On success we just flip the local card to is_earned=true, is_claimable=false
  // — no full refetch of /api/achievements. Server is source of truth on next
  // navigation. We refetch ONLY on failure to roll back any UI drift.
  const onClaimAchievement = async (slug: string) => {
    if (claiming.has(slug)) return
    setClaiming((s) => new Set(s).add(slug))

    // Snapshot for rollback
    const prevAchievements = achievements

    // Optimistic flip
    setAchievements((list) =>
      list.map((a) =>
        a.slug === slug
          ? {
              ...a,
              is_earned: true,
              is_claimable: false,
              earned_at: a.earned_at ?? new Date().toISOString(),
            }
          : a
      )
    )

    try {
      const res = await fetch(`/api/achievements/${slug}/claim`, { method: "POST" })
      if (!res.ok) {
        // Rollback + show error
        setAchievements(prevAchievements)
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line no-alert
        alert(err?.error ?? "Не удалось получить достижение")
        // Authoritative refetch in background so any side-effects
        // (XP-bumped streaks, chained достижения) sync without waiting.
        try {
          const aRes = await fetch("/api/achievements", { cache: "no-store" })
          if (aRes.ok) {
            const aJson = await aRes.json()
            setAchievements(aJson.achievements ?? prevAchievements)
          }
        } catch {}
      }
    } catch {
      // Network error — rollback
      setAchievements(prevAchievements)
    } finally {
      setClaiming((s) => {
        const n = new Set(s)
        n.delete(slug)
        return n
      })
    }
  }

  // Claim reward (digital only — physical needs delivery modal, not in scope here)
  // OPTIMISTIC: flip already_claimed=true locally, rollback on failure.
  const onClaimReward = async (reward: Reward) => {
    if (reward.reward_type === "physical") {
      // eslint-disable-next-line no-alert
      alert(
        "Для физической награды заполни адрес доставки — форму добавим в следующей итерации."
      )
      return
    }
    if (claiming.has(reward.slug)) return
    setClaiming((s) => new Set(s).add(reward.slug))

    const prevRewards = rewards
    setRewards((list) =>
      list.map((r) =>
        r.slug === reward.slug
          ? { ...r, already_claimed: true, claimed_status: "claimed" }
          : r
      )
    )

    try {
      const res = await fetch(`/api/rewards/${reward.slug}/claim`, { method: "POST" })
      if (!res.ok) {
        setRewards(prevRewards)
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line no-alert
        alert(err?.error ?? "Не удалось получить награду")
        try {
          const rRes = await fetch("/api/rewards", { cache: "no-store" })
          if (rRes.ok) {
            const rJson = await rRes.json()
            setRewards(rJson.rewards ?? prevRewards)
          }
        } catch {}
      }
    } catch {
      setRewards(prevRewards)
    } finally {
      setClaiming((s) => {
        const n = new Set(s)
        n.delete(reward.slug)
        return n
      })
    }
  }

  return (
    <div className="achievements-page">

      {/* Header */}
      <div className="ach-hdr">
        <h1>
          {t("headingMain")} <span className="gl">{t("headingHighlight")}</span>
        </h1>
        <div className="ach-hdr-sub">
          {t("subtitle")}
        </div>
      </div>

      {/* XP ring */}
      <div className="xp-ring-wrap">
        <div className="xp-ring">
          <svg viewBox="0 0 160 160">
            <circle className="xp-ring-bg" cx="80" cy="80" r="70" />
            <circle
              className="xp-ring-fill"
              cx="80"
              cy="80"
              r="70"
              style={{
                strokeDasharray: ringCirc,
                strokeDashoffset: ringOffset,
              }}
            />
          </svg>
          <div className="xp-ring-center">
            <div className="xp-ring-pct">{stats.pct}%</div>
            <div className="xp-ring-label">{t("ringLabel")}</div>
            <div className="xp-ring-sub">
              {stats.earned} / {stats.total}
            </div>
          </div>
        </div>
      </div>

      {/* Hero stats */}
      <div className="hero-stats">
        <div className="hs hs--red">
          <div className="hs-val">
            {stats.earned} / {stats.total}
          </div>
          <div className="hs-label">{t("statAchievements")}</div>
        </div>
        <div className="hs">
          <div className="hs-val">+{fmtNum(stats.xpEarned)}</div>
          <div className="hs-label">XP</div>
        </div>
        <div className="hs hs--lime">
          <div className="hs-val">{stats.rewardsEarned}</div>
          <div className="hs-label">{t("statPrizes")}</div>
        </div>
        <div className="hs hs--gold">
          <div className="hs-val">
            <span className="gl">{stats.next?.title ?? "—"}</span>
          </div>
          <div className="hs-label">{t("statNext")}</div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`ct${activeCat === "all" ? " active" : ""}`}
          onClick={() => setActiveCat("all")}
        >
          {t("tabAll")} ({stats.total})
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = achievements.filter((a) => a.category === cat).length
          return (
            <button
              type="button"
              key={cat}
              className={`ct${activeCat === cat ? " active" : ""}`}
              onClick={() => setActiveCat(cat)}
            >
              {CATEGORY_META_LOCALIZED[cat].tab}
              {count > 0 ? ` (${count})` : ""}
            </button>
          )
        })}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="ag">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      ) : visibleAchievements.length === 0 ? (
        <div className="ach-empty">{t("empty")}</div>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? []
          if (items.length === 0) return null
          const earned = items.filter((i) => i.is_earned).length
          const total = items.length
          const pct = total > 0 ? Math.round((earned / total) * 100) : 0
          const meta = CATEGORY_META_LOCALIZED[cat]
          return (
            <div key={cat} className="cat">
              <div className="cat-head">
                <div className="cat-emoji">{meta.emoji}</div>
                <div className="cat-name">{meta.name}</div>
                <div className="cat-bar">
                  <div className="cat-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="cat-count">
                  {earned} / {total}
                </div>
              </div>
              <div className="ag">
                {items.map((a) => {
                  const pctA =
                    a.threshold > 0
                      ? Math.min(100, Math.round(((a.current_value ?? 0) / a.threshold) * 100))
                      : 0
                  const showProgress = !a.is_earned && pctA > 0 && pctA < 100
                  const isClaimable = a.is_claimable
                  const classes = [
                    "ac",
                    `ac--${a.rarity}`,
                    a.is_earned ? "ac--earned" : "",
                    !a.is_earned && pctA === 0 ? "ac--locked" : "",
                    isClaimable ? "ac--claimable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                  return (
                    <div key={a.id} className={classes}>
                      {a.is_earned ? (
                        <div className="ac-check">✓</div>
                      ) : (
                        <div className={`ac-rarity ac-rarity--${a.rarity}`}>
                          {RARITY_LABEL[a.rarity]}
                        </div>
                      )}
                      <div className="ac-icon">{a.icon_emoji ?? "🏅"}</div>
                      <div className="ac-name">{a.title}</div>
                      <div className="ac-desc">{a.description}</div>
                      <div className="ac-xp">+{fmtNum(a.xp_reward)} XP</div>
                      {a.reward_label ? (
                        <div
                          className={`ac-reward ac-reward--${
                            a.reward_type === "physical" ? "physical" : "digital"
                          }`}
                        >
                          {a.reward_label}
                        </div>
                      ) : null}
                      {showProgress ? (
                        <div className="ac-prog">
                          <div className="ac-prog-row">
                            <span>
                              {fmtNum(a.current_value ?? 0)} / {fmtNum(a.threshold)}
                            </span>
                            <span>{pctA}%</span>
                          </div>
                          <div className="ac-bar">
                            <div className="ac-bar-fill" style={{ width: `${pctA}%` }} />
                          </div>
                        </div>
                      ) : null}
                      {isClaimable ? (
                        <button
                          type="button"
                          className="ac-claim-btn"
                          onClick={() => onClaimAchievement(a.slug)}
                          disabled={claiming.has(a.slug)}
                        >
                          {claiming.has(a.slug) ? t("claiming") : t("claim")}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* ===== REWARD SHOP ===== */}
      <div className="shop-title">🎁 {t("shopTitle")}</div>
      <div className="shop-sub">{t("shopSub")}</div>

      {loading ? (
        <div className="shop-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      ) : rewards.length === 0 ? (
        <div className="ach-empty">{t("shopEmpty")}</div>
      ) : (
        <div className="shop-grid">
          {rewards.map((r) => {
            const isEarned = r.already_claimed
            const isClaimable = !isEarned && r.is_eligible
            const classes = [
              "rw",
              isEarned ? "rw--earned" : "",
              isClaimable ? "rw--next" : "",
              !isEarned && !isClaimable ? "rw--locked" : "",
            ]
              .filter(Boolean)
              .join(" ")
            return (
              <div key={r.id} className={classes}>
                <div className="rw-icon">{r.icon_emoji ?? "🎁"}</div>
                <div className="rw-name">{r.title}</div>
                <div className="rw-desc">{r.description ?? ""}</div>
                {isEarned ? (
                  <span className="rw-status rw-status--earned">✓ Получено</span>
                ) : isClaimable ? (
                  <button
                    type="button"
                    className="rw-status rw-status--claimable"
                    onClick={() => onClaimReward(r)}
                    disabled={claiming.has(r.slug)}
                  >
                    {claiming.has(r.slug) ? t("claiming") : t("claimReward")}
                  </button>
                ) : (
                  <span className="rw-status rw-status--locked">
                    {rewardLockLabel(r)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock hint text for reward shop (derived from claim_criteria)
// ─────────────────────────────────────────────────────────────────────────────

function rewardLockLabel(r: Reward): string {
  const c = r.claim_criteria
  if (!c || typeof c !== "object") return "Заблокировано"
  const fmt = (k: string, v: any): string => {
    if (k === "streak") return `${v}-day streak`
    if (k === "longest_streak") return `${v} дней стрика`
    if (k === "total_xp") return `${fmtNum(v)} XP`
    if (k === "clubs_attended") return `${v} клубов`
    if (k === "platform_days") return `${v} дней на платформе`
    if (k === "leaderboard_rank_max") return `Топ-${v} лидерборда`
    if (k === "daily_challenge_streak") return `${v} daily подряд`
    return `${k}: ${v}`
  }
  if (c.any && Array.isArray(c.any)) {
    return c.any
      .map((sub: any) => {
        const key = Object.keys(sub)[0]
        return fmt(key, sub[key])
      })
      .join(" или ")
  }
  if (c.all && Array.isArray(c.all)) {
    return c.all
      .map((sub: any) => {
        const key = Object.keys(sub)[0]
        return fmt(key, sub[key])
      })
      .join(" и ")
  }
  const key = Object.keys(c)[0]
  return fmt(key, c[key])
}
