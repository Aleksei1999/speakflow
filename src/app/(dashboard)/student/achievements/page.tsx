"use client"

import { useEffect, useMemo, useState } from "react"

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

const ACHIEVEMENTS_CSS = `
.achievements-page{max-width:1100px;margin:0 auto;--gold:#C8A200;--purple:#9333EA;--cyan:#0891B2}
[data-theme="dark"] .achievements-page{--gold:#FFD700;--purple:#A855F7;--cyan:#22D3EE}

/* Header */
.achievements-page .ach-hdr{text-align:center;margin-bottom:28px;position:relative}
.achievements-page .ach-hdr::before{content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(230,57,70,.08),transparent 70%);pointer-events:none}
.achievements-page .ach-hdr h1{font-size:2rem;font-weight:800;letter-spacing:-.8px;position:relative;color:var(--text)}
.achievements-page .ach-hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.achievements-page .ach-hdr-sub{font-size:.85rem;color:var(--muted);margin-top:4px;position:relative}

/* XP ring */
.achievements-page .xp-ring-wrap{display:flex;justify-content:center;margin-bottom:28px}
.achievements-page .xp-ring{position:relative;width:160px;height:160px}
.achievements-page .xp-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.achievements-page .xp-ring-bg{fill:none;stroke:var(--border);stroke-width:8}
.achievements-page .xp-ring-fill{fill:none;stroke:var(--red);stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)}
.achievements-page .xp-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.achievements-page .xp-ring-pct{font-size:2rem;font-weight:800;letter-spacing:-1px;line-height:1;color:var(--text)}
.achievements-page .xp-ring-label{font-size:.6rem;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.achievements-page .xp-ring-sub{font-size:.65rem;color:var(--red);font-weight:700;margin-top:4px}

/* Hero stats */
.achievements-page .hero-stats{display:flex;gap:12px;justify-content:center;margin-bottom:28px;flex-wrap:wrap}
.achievements-page .hs{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 24px;text-align:center;min-width:140px;transition:all .2s}
.achievements-page .hs:hover{transform:translateY(-3px);box-shadow:0 8px 24px var(--shadow)}
.achievements-page .hs-val{font-size:1.5rem;font-weight:800;letter-spacing:-.5px;line-height:1;color:var(--text)}
.achievements-page .hs-val .gl{font-family:'Gluten',cursive}
.achievements-page .hs-label{font-size:.6rem;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.achievements-page .hs--red .hs-val{color:var(--red)}
.achievements-page .hs--lime{background:var(--lime);border-color:var(--lime)}
.achievements-page .hs--lime .hs-val{color:#0A0A0A}
.achievements-page .hs--lime .hs-label{color:rgba(0,0,0,.55)}
.achievements-page .hs--gold .hs-val{color:var(--gold)}

/* Category tabs */
.achievements-page .cat-tabs{display:flex;gap:6px;margin-bottom:24px;padding-bottom:4px;-webkit-overflow-scrolling:touch;justify-content:center;flex-wrap:wrap}
.achievements-page .ct{padding:8px 16px;border-radius:100px;border:1px solid var(--border);background:var(--surface);font-size:.72rem;font-weight:600;color:var(--muted);transition:all .15s;white-space:nowrap;cursor:pointer;font-family:inherit}
.achievements-page .ct:hover{border-color:var(--text);color:var(--text)}
.achievements-page .ct.active{background:var(--red);color:#fff;border-color:var(--red)}

/* Category */
.achievements-page .cat{margin-bottom:36px}
.achievements-page .cat-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.achievements-page .cat-emoji{font-size:1.3rem}
.achievements-page .cat-name{font-size:1rem;font-weight:800;color:var(--text)}
.achievements-page .cat-count{font-size:.62rem;color:var(--muted);font-weight:600;margin-left:auto}
.achievements-page .cat-bar{flex:1;max-width:200px;height:4px;background:var(--border);border-radius:100px;overflow:hidden;margin-left:8px}
.achievements-page .cat-bar-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--red),var(--lime));transition:width .8s ease}

/* Achievement grid */
.achievements-page .ag{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}

/* Achievement card */
.achievements-page .ac{
  background:var(--surface);border:1px solid var(--border);border-radius:18px;
  padding:20px;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.16,1,.3,1);
}
.achievements-page .ac:hover{transform:translateY(-4px);box-shadow:0 12px 30px var(--shadow)}

/* Rarity */
.achievements-page .ac--common{border-color:var(--border)}
.achievements-page .ac--rare{border-color:color-mix(in srgb, var(--cyan) 25%, var(--border))}
.achievements-page .ac--rare:hover{box-shadow:0 0 20px color-mix(in srgb, var(--cyan) 15%, transparent),0 12px 30px var(--shadow)}
.achievements-page .ac--epic{border-color:color-mix(in srgb, var(--purple) 25%, var(--border))}
.achievements-page .ac--epic:hover{box-shadow:0 0 20px color-mix(in srgb, var(--purple) 15%, transparent),0 12px 30px var(--shadow)}
.achievements-page .ac--legendary{border-color:color-mix(in srgb, var(--gold) 30%, var(--border));background:linear-gradient(135deg,var(--surface),color-mix(in srgb, var(--gold) 4%, transparent))}
.achievements-page .ac--legendary:hover{box-shadow:0 0 25px color-mix(in srgb, var(--gold) 18%, transparent),0 12px 30px var(--shadow)}

/* Locked */
.achievements-page .ac--locked{opacity:.45}
.achievements-page .ac--locked:hover{opacity:.6;transform:none}
.achievements-page .ac--locked .ac-icon{filter:grayscale(1) brightness(.7)}
[data-theme="dark"] .achievements-page .ac--locked{opacity:.3}
[data-theme="dark"] .achievements-page .ac--locked:hover{opacity:.45}
[data-theme="dark"] .achievements-page .ac--locked .ac-icon{filter:grayscale(1) brightness(.5)}

/* Earned */
.achievements-page .ac--earned::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime))}
.achievements-page .ac--earned .ac-check{display:flex}

.achievements-page .ac-check{display:none;position:absolute;top:12px;right:12px;width:24px;height:24px;border-radius:50%;background:var(--lime);align-items:center;justify-content:center;font-size:.65rem;font-weight:800;color:#0A0A0A;box-shadow:0 2px 8px rgba(216,242,106,.3)}

.achievements-page .ac-rarity{position:absolute;top:12px;right:12px;font-size:.5rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:4px}
.achievements-page .ac-rarity--common{background:var(--surface-2);color:var(--muted)}
.achievements-page .ac-rarity--rare{background:color-mix(in srgb, var(--cyan) 15%, transparent);color:var(--cyan)}
.achievements-page .ac-rarity--epic{background:color-mix(in srgb, var(--purple) 15%, transparent);color:var(--purple)}
.achievements-page .ac-rarity--legendary{background:color-mix(in srgb, var(--gold) 15%, transparent);color:var(--gold)}
.achievements-page .ac--earned .ac-rarity{display:none}

.achievements-page .ac-icon{font-size:2rem;margin-bottom:12px;display:block;transition:transform .3s}
.achievements-page .ac:hover .ac-icon{transform:scale(1.15) rotate(-5deg)}

.achievements-page .ac-name{font-size:.88rem;font-weight:800;margin-bottom:3px;color:var(--text)}
.achievements-page .ac-desc{font-size:.7rem;color:var(--muted);line-height:1.4;margin-bottom:10px}

.achievements-page .ac-xp{display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:6px;font-size:.62rem;font-weight:700;background:color-mix(in srgb, var(--red) 10%, transparent);color:var(--red)}

/* Progress */
.achievements-page .ac-prog{margin-top:10px}
.achievements-page .ac-prog-row{display:flex;justify-content:space-between;font-size:.55rem;color:var(--muted);font-weight:600;margin-bottom:3px}
.achievements-page .ac-bar{height:4px;background:var(--border);border-radius:100px;overflow:hidden}
.achievements-page .ac-bar-fill{height:100%;border-radius:100px;background:var(--red);transition:width 1s ease}

/* Reward tag */
.achievements-page .ac-reward{margin-top:8px;padding:4px 10px;border-radius:6px;font-size:.55rem;font-weight:700;display:inline-flex;align-items:center;gap:4px}
.achievements-page .ac-reward--physical{background:color-mix(in srgb, var(--gold) 10%, transparent);color:var(--gold)}
.achievements-page .ac-reward--digital{background:color-mix(in srgb, var(--lime) 20%, transparent);color:var(--lime-dark)}
[data-theme="dark"] .achievements-page .ac-reward--digital{background:color-mix(in srgb, var(--lime) 10%, transparent);color:var(--lime)}

/* Claimable highlight */
.achievements-page .ac--claimable{border-color:var(--lime)}
.achievements-page .ac-claim-btn{margin-top:10px;padding:8px 14px;border:none;border-radius:10px;background:var(--lime);color:#0A0A0A;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;width:100%;transition:all .15s}
.achievements-page .ac-claim-btn:hover:not(:disabled){filter:brightness(.95);transform:translateY(-1px)}
.achievements-page .ac-claim-btn:disabled{opacity:.6;cursor:not-allowed}

/* ===== REWARD SHOP ===== */
.achievements-page .shop-title{font-size:1.3rem;font-weight:800;letter-spacing:-.5px;margin-bottom:4px;margin-top:24px;text-align:center;color:var(--text)}
.achievements-page .shop-sub{font-size:.82rem;color:var(--muted);margin-bottom:20px;text-align:center}
.achievements-page .shop-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}

.achievements-page .rw{
  background:var(--surface);border:1px solid var(--border);border-radius:18px;
  padding:22px;text-align:center;position:relative;overflow:hidden;transition:all .3s;
}
.achievements-page .rw:hover{transform:translateY(-4px);box-shadow:0 12px 30px var(--shadow)}
.achievements-page .rw--earned{border-color:var(--lime)}
.achievements-page .rw--earned::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--lime)}
.achievements-page .rw--locked{opacity:.5}
.achievements-page .rw--locked:hover{opacity:.6;transform:none}
[data-theme="dark"] .achievements-page .rw--locked{opacity:.3}
[data-theme="dark"] .achievements-page .rw--locked:hover{opacity:.4}
.achievements-page .rw--next{border-color:color-mix(in srgb, var(--red) 30%, var(--border));animation:achNextPulse 3s ease-in-out infinite}
@keyframes achNextPulse{0%,100%{box-shadow:0 0 0 0 rgba(230,57,70,0)}50%{box-shadow:0 0 0 6px rgba(230,57,70,.06)}}

.achievements-page .rw-icon{font-size:2.2rem;margin-bottom:10px;display:block}
.achievements-page .rw--locked .rw-icon{filter:grayscale(1) brightness(.7)}
[data-theme="dark"] .achievements-page .rw--locked .rw-icon{filter:grayscale(1) brightness(.4)}
.achievements-page .rw-name{font-size:.9rem;font-weight:800;margin-bottom:4px;color:var(--text)}
.achievements-page .rw-desc{font-size:.7rem;color:var(--muted);line-height:1.4;margin-bottom:12px;min-height:2.4em}

.achievements-page .rw-status{padding:6px 14px;border-radius:8px;font-size:.65rem;font-weight:700;display:inline-block;border:none;font-family:inherit;cursor:default}
.achievements-page .rw-status--earned{background:var(--lime);color:#0A0A0A}
.achievements-page .rw-status--claimable{background:var(--red);color:#fff;cursor:pointer;transition:all .15s}
.achievements-page .rw-status--claimable:hover:not(:disabled){filter:brightness(.95);transform:translateY(-1px)}
.achievements-page .rw-status--locked{background:var(--surface-2);color:var(--muted)}

/* Empty/loading */
.achievements-page .ach-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:.9rem;background:var(--surface);border:1px dashed var(--border);border-radius:16px;margin-top:14px}
.achievements-page .skel{background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:achShimmer 1.4s ease infinite;border-radius:18px;height:170px}
@keyframes achShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}

/* Responsive */
@media(max-width:900px){
  .achievements-page .ag{grid-template-columns:1fr 1fr}
  .achievements-page .shop-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:600px){
  .achievements-page .ag{grid-template-columns:1fr}
  .achievements-page .shop-grid{grid-template-columns:1fr}
  .achievements-page .cat-tabs{justify-content:flex-start;overflow-x:auto}
  .achievements-page .hero-stats .hs{min-width:calc(50% - 6px);padding:14px 10px}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pluralizeAchievements(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "ачивка"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "ачивки"
  return "ачивок"
}

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentAchievementsPage() {
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
  const stats = useMemo(() => {
    const total = achievements.length || 37
    const earned = achievements.filter((a) => a.is_earned).length
    const xpEarned = achievements
      .filter((a) => a.is_earned)
      .reduce((sum, a) => sum + (a.xp_reward ?? 0), 0)
    const rewardsEarned = rewards.filter((r) => r.already_claimed).length
    // Next = not earned, closest to threshold (highest ratio)
    const next = achievements
      .filter((a) => !a.is_earned && a.threshold > 0)
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

  // Claim achievement reward
  const onClaimAchievement = async (slug: string) => {
    if (claiming.has(slug)) return
    setClaiming((s) => new Set(s).add(slug))
    try {
      const res = await fetch(`/api/achievements/${slug}/claim`, { method: "POST" })
      if (res.ok) {
        // Refetch achievements after claim
        const aRes = await fetch("/api/achievements", { cache: "no-store" })
        if (aRes.ok) {
          const aJson = await aRes.json()
          setAchievements(aJson.achievements ?? [])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line no-alert
        alert(err?.error ?? "Не удалось получить ачивку")
      }
    } finally {
      setClaiming((s) => {
        const n = new Set(s)
        n.delete(slug)
        return n
      })
    }
  }

  // Claim reward (digital only — physical needs delivery modal, not in scope here)
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
    try {
      const res = await fetch(`/api/rewards/${reward.slug}/claim`, { method: "POST" })
      if (res.ok) {
        const rRes = await fetch("/api/rewards", { cache: "no-store" })
        if (rRes.ok) {
          const rJson = await rRes.json()
          setRewards(rJson.rewards ?? [])
        }
      } else {
        const err = await res.json().catch(() => ({}))
        // eslint-disable-next-line no-alert
        alert(err?.error ?? "Не удалось получить награду")
      }
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
      <style dangerouslySetInnerHTML={{ __html: ACHIEVEMENTS_CSS }} />

      {/* Header */}
      <div className="ach-hdr">
        <h1>
          Мои <span className="gl">achievements</span>
        </h1>
        <div className="ach-hdr-sub">
          Зарабатывай XP, открывай ачивки, получай реальные призы
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
            <div className="xp-ring-label">Ачивок открыто</div>
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
          <div className="hs-label">Ачивок</div>
        </div>
        <div className="hs">
          <div className="hs-val">+{fmtNum(stats.xpEarned)}</div>
          <div className="hs-label">XP за ачивки</div>
        </div>
        <div className="hs hs--lime">
          <div className="hs-val">{stats.rewardsEarned}</div>
          <div className="hs-label">Призов получено</div>
        </div>
        <div className="hs hs--gold">
          <div className="hs-val">
            <span className="gl">{stats.next?.title ?? "—"}</span>
          </div>
          <div className="hs-label">Следующая ачивка</div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`ct${activeCat === "all" ? " active" : ""}`}
          onClick={() => setActiveCat("all")}
        >
          Все ({stats.total})
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
              {CATEGORY_META[cat].tab}
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
        <div className="ach-empty">Ачивки скоро появятся</div>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat) ?? []
          if (items.length === 0) return null
          const earned = items.filter((i) => i.is_earned).length
          const total = items.length
          const pct = total > 0 ? Math.round((earned / total) * 100) : 0
          const meta = CATEGORY_META[cat]
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
                          {claiming.has(a.slug) ? "…" : "Забрать награду"}
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
      <div className="shop-title">🎁 Призы и подарки</div>
      <div className="shop-sub">Реальные награды за реальный прогресс</div>

      {loading ? (
        <div className="shop-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      ) : rewards.length === 0 ? (
        <div className="ach-empty">Призы появятся скоро</div>
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
                    {claiming.has(r.slug) ? "…" : "Забрать"}
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
