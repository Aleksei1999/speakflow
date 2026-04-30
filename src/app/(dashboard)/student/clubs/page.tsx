"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  addDays,
  addWeeks,
  endOfDay,
  format,
  isSameDay,
  isTomorrow,
  startOfWeek,
} from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror of /api/clubs and /api/clubs/stats response shapes)
// ─────────────────────────────────────────────────────────────────────────────

type ClubCategory =
  | "speaking"
  | "business"
  | "movies"
  | "debate"
  | "wine"
  | "career"
  | "community"
  | "storytelling"
  | "smalltalk"
  | "other"

type RoastLevel =
  | "Raw"
  | "Rare"
  | "Medium Rare"
  | "Medium"
  | "Medium Well"
  | "Well Done"

type ClubHost = {
  role: string | null
  sort_order: number | null
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    initials: string | null
  } | null
}

type Club = {
  id: string
  topic: string
  description: string | null
  category: ClubCategory
  level_min: RoastLevel | null
  level_max: RoastLevel | null
  format: string | null
  location: string | null
  timezone: string | null
  starts_at: string
  duration_min: number
  max_seats: number
  seats_taken: number
  price_kopecks: number
  xp_reward: number
  badge: string | null
  cover_emoji: string | null
  is_published: boolean
  cancelled_at: string | null
  club_hosts: ClubHost[]
  seats_remaining: number
  is_full: boolean
  my_registration_status: string | null
  is_user_registered: boolean
}

type ClubsStats = {
  weekCount: number
  attendedThisMonth: number
  nextClub: {
    id: string
    starts_at: string
    club_type: ClubCategory
    topic: string
    duration_min: number
    cover_emoji: string | null
    registration_id: string
    registration_status: string
  } | null
  xpThisMonth: number
  meta?: unknown
}

type FilterKey = "all" | "speaking" | "debate" | "wine" | "niche" | "raw-rare" | "medium-plus"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROAST_LEVELS: RoastLevel[] = [
  "Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done",
]

const NICHE_CATEGORIES: ClubCategory[] = ["community", "smalltalk", "storytelling", "other"]

const CALENDAR_HOURS = [10, 12, 14, 16, 18, 19, 20]

// Category → visual group used by .ev--X and .cs-X
function categoryGroup(cat: ClubCategory): "s" | "d" | "w" | "n" {
  if (cat === "debate") return "d"
  if (cat === "wine" || cat === "movies") return "w"
  if (NICHE_CATEGORIES.includes(cat)) return "n"
  return "s"
}

function roastIdx(l: RoastLevel | null, fallback: number): number {
  if (!l) return fallback
  const i = ROAST_LEVELS.indexOf(l)
  return i === -1 ? fallback : i
}

// Format level range tag like "Raw–Rare" / "Medium+" / "Все уровни"
function levelTag(min: RoastLevel | null, max: RoastLevel | null): string {
  const minIdx = roastIdx(min, 0)
  const maxIdx = roastIdx(max, ROAST_LEVELS.length - 1)
  const openAbove = maxIdx >= ROAST_LEVELS.length - 1
  const openBelow = minIdx <= 0
  if (openAbove && openBelow) return "Все уровни"
  if (minIdx >= ROAST_LEVELS.indexOf("Medium")) return "Medium+"
  if (openAbove) return `${ROAST_LEVELS[minIdx]}+`
  if (openBelow) return `${ROAST_LEVELS[0]}–${ROAST_LEVELS[maxIdx]}`
  if (minIdx === maxIdx) return ROAST_LEVELS[minIdx]
  return `${ROAST_LEVELS[minIdx]}–${ROAST_LEVELS[maxIdx]}`
}

function categoryTag(cat: ClubCategory): string {
  switch (cat) {
    case "speaking": return "Speaking"
    case "business": return "Business"
    case "movies": return "Movies"
    case "debate": return "Debate"
    case "wine": return "Casual"
    case "career": return "Career"
    case "community": return "Community"
    case "storytelling": return "Stories"
    case "smalltalk": return "Small talk"
    case "other": return "Other"
    default: return "Club"
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles (ported from speaking-clubs.html, scoped to .clubs-page)
// ─────────────────────────────────────────────────────────────────────────────

const CLUBS_CSS = `
.clubs-page{max-width:1100px;margin:0 auto}
.clubs-page .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:12px}
.clubs-page .hdr h1{font-size:1.6rem;font-weight:800;letter-spacing:-.6px}
.clubs-page .hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.clubs-page .hdr-sub{font-size:.82rem;color:var(--muted);margin-bottom:20px}

/* Filters */
.clubs-page .filters{display:flex;gap:5px;margin-bottom:20px;flex-wrap:wrap}
.clubs-page .pill{padding:7px 14px;border-radius:100px;border:1px solid var(--border);background:var(--surface);font-size:.72rem;font-weight:600;color:var(--muted);transition:all .15s;cursor:pointer;font-family:inherit}
.clubs-page .pill:hover{border-color:var(--text);color:var(--text)}
.clubs-page .pill.active{background:#0A0A0A;color:#fff;border-color:#0A0A0A}

/* Stats */
.clubs-page .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.clubs-page .st{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.clubs-page .st-label{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.clubs-page .st-val{font-size:1.4rem;font-weight:800;margin-top:4px;letter-spacing:-.5px;line-height:1}
.clubs-page .st-val .gl{font-family:'Gluten',cursive}
.clubs-page .st-sub{font-size:.6rem;color:var(--muted);margin-top:4px}
.clubs-page .st--red .st-val{color:var(--red)}
.clubs-page .st--lime{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.clubs-page .st--lime .st-label{color:rgba(0,0,0,.5)}
.clubs-page .st--lime .st-sub{color:rgba(0,0,0,.55)}
.clubs-page .st--dark{background:#0A0A0A;color:#fff;border-color:#0A0A0A}
.clubs-page .st--dark .st-label,.clubs-page .st--dark .st-sub{color:#A0A09A}

/* Calendar */
.clubs-page .cal{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:0 2px 0 var(--border),0 8px 30px var(--shadow);margin-bottom:28px;overflow:hidden}
.clubs-page .cal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)}
.clubs-page .cal-nav{display:flex;align-items:center;gap:10px}
.clubs-page .cal-title{font-size:.95rem;font-weight:700}
.clubs-page .cal-arr{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.8rem;transition:all .15s;cursor:pointer;font-family:inherit}
.clubs-page .cal-arr:hover{border-color:var(--text);color:var(--text)}
.clubs-page .cal-today{padding:5px 14px;border-radius:8px;background:var(--red);color:#fff;font-size:.68rem;font-weight:700;border:none;cursor:pointer;font-family:inherit}
.clubs-page .cal-legend{display:flex;gap:14px;padding:8px 20px;border-bottom:1px solid var(--border);background:var(--surface-2);flex-wrap:wrap}
.clubs-page .cl{display:flex;align-items:center;gap:5px;font-size:.6rem;font-weight:600;color:var(--muted)}
.clubs-page .cl-dot{width:8px;height:8px;border-radius:3px}
.clubs-page .cl-s{background:var(--red)}
.clubs-page .cl-d{background:#0A0A0A}
.clubs-page .cl-w{background:#a855f7}
.clubs-page .cl-n{background:var(--lime)}

.clubs-page .cg-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.clubs-page .cg{display:grid;grid-template-columns:50px repeat(7,1fr);min-width:680px}
.clubs-page .cg-corner{border-right:1px solid var(--border);border-bottom:2px solid var(--border)}
.clubs-page .cg-dh{padding:8px 4px;text-align:center;border-bottom:2px solid var(--border);border-right:1px solid var(--border);position:relative;background:var(--surface)}
.clubs-page .cg-dh:last-child{border-right:none}
.clubs-page .cg-dn{font-size:.52rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.clubs-page .cg-dd{font-size:1rem;font-weight:800;letter-spacing:-.5px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:2px auto 0}
.clubs-page .cg-dh--today .cg-dd{background:var(--red);color:#fff}
.clubs-page .cg-dh--today::after{content:'';position:absolute;bottom:-2px;left:25%;right:25%;height:2px;background:var(--red);border-radius:2px}
.clubs-page .cg-t{padding:2px 4px 2px 0;text-align:right;font-size:.58rem;font-weight:600;color:var(--muted);border-right:1px solid var(--border);height:68px;display:flex;align-items:flex-start;justify-content:flex-end}
.clubs-page .cg-c{height:68px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:2px;position:relative;background:var(--surface)}
.clubs-page .cg-c:last-child{border-right:none}

.clubs-page .ev{position:absolute;left:2px;right:2px;top:2px;padding:4px 6px;border-radius:7px;font-size:.58rem;font-weight:600;line-height:1.2;cursor:pointer;transition:all .15s;overflow:hidden;z-index:2;border-left:3px solid;font-family:inherit;text-align:left;width:auto}
.clubs-page .ev:hover{transform:scale(1.04);box-shadow:0 4px 12px var(--shadow);z-index:5}
.clubs-page .ev-n{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clubs-page .ev-s{font-size:.5rem;opacity:.6;margin-top:1px}
.clubs-page .ev--s{background:rgba(230,57,70,.1);color:var(--red);border-color:var(--red)}
.clubs-page .ev--d{background:rgba(10,10,10,.06);color:var(--text);border-color:#0A0A0A}
.clubs-page .ev--w{background:rgba(168,85,247,.07);color:#7c3aed;border-color:#a855f7}
.clubs-page .ev--n{background:rgba(216,242,106,.15);color:var(--lime-dark);border-color:var(--lime)}
.clubs-page .ev--full{opacity:.35}
.clubs-page .ev--soon{box-shadow:0 0 0 2px rgba(230,57,70,.15)}
.clubs-page .ev-seats{font-size:.48rem;font-weight:700;margin-top:1px}
.clubs-page .ev-seats b{color:var(--red)}
.clubs-page .ev--highlight{outline:3px solid var(--lime);outline-offset:-3px;animation:clubsFlash 1.2s ease-in-out}
@keyframes clubsFlash{0%,100%{outline-color:var(--lime)}50%{outline-color:transparent}}

/* List cards */
.clubs-page .sec-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;padding:14px 0 10px;display:flex;align-items:center;gap:8px}
.clubs-page .badge{padding:3px 9px;border-radius:6px;font-size:.58rem;font-weight:700;text-transform:none;letter-spacing:0}
.clubs-page .badge--today{background:var(--red);color:#fff}
.clubs-page .badge--tm{background:rgba(216,242,106,.2);color:var(--lime-dark)}

.clubs-page .cc{display:flex;align-items:stretch;background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .2s}
.clubs-page .cc:hover{border-color:rgba(230,57,70,.15);box-shadow:0 6px 20px var(--shadow)}
.clubs-page .cc--highlight{border-color:var(--lime);box-shadow:0 0 0 2px rgba(216,242,106,.35)}
.clubs-page .cc-strip{width:5px;flex-shrink:0}
.clubs-page .cs-s{background:var(--red)}
.clubs-page .cs-d{background:#0A0A0A}
.clubs-page .cs-w{background:#a855f7}
.clubs-page .cs-n{background:var(--lime)}
.clubs-page .cc-time{width:76px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 6px;border-right:1px solid var(--border);background:var(--surface-2)}
.clubs-page .cc-tv{font-size:1.05rem;font-weight:800;letter-spacing:-.5px;line-height:1}
.clubs-page .cc-td{font-size:.58rem;color:var(--muted);margin-top:2px}
.clubs-page .cc-xp{font-size:.52rem;font-weight:700;color:var(--lime-dark);margin-top:4px;padding:2px 6px;background:rgba(216,242,106,.12);border-radius:4px}
.clubs-page .cc-body{flex:1;padding:12px 14px;display:flex;flex-direction:column;justify-content:center;min-width:0}
.clubs-page .cc-topic{font-size:.88rem;font-weight:700;margin-bottom:1px}
.clubs-page .cc-desc{font-size:.68rem;color:var(--muted);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.clubs-page .cc-tags{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap}
.clubs-page .cc-tag{padding:2px 6px;border-radius:4px;font-size:.52rem;font-weight:600;background:var(--bg);color:var(--muted)}
.clubs-page .cc-tag--lvl{background:rgba(230,57,70,.06);color:var(--red)}

.clubs-page .cc-host{display:flex;align-items:center;gap:8px;padding:12px;border-left:1px solid var(--border);flex-shrink:0}
.clubs-page .cc-ha{width:32px;height:32px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700;flex-shrink:0;overflow:hidden}
.clubs-page .cc-ha img{width:100%;height:100%;object-fit:cover;border-radius:10px}
.clubs-page .cc-hn{font-size:.7rem;font-weight:600;white-space:nowrap}
.clubs-page .cc-hr{font-size:.55rem;color:var(--muted)}

.clubs-page .cc-right{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 14px;border-left:1px solid var(--border);flex-shrink:0;gap:4px;min-width:110px}
.clubs-page .cc-seats{font-size:.62rem;font-weight:600;color:var(--muted);display:flex;align-items:center;gap:3px}
.clubs-page .cc-seats-dots{display:flex;gap:2px}
.clubs-page .sd{width:6px;height:6px;border-radius:50%}
.clubs-page .sd-t{background:var(--red)}
.clubs-page .sd-f{background:var(--border)}
.clubs-page .cc-seats-warn{color:var(--red);font-weight:700}
.clubs-page .cc-btn{padding:7px 16px;border-radius:10px;font-size:.72rem;font-weight:700;border:none;white-space:nowrap;transition:all .15s;width:100%;text-align:center;cursor:pointer;font-family:inherit}
.clubs-page .cc-btn:disabled{cursor:not-allowed}
.clubs-page .cc-btn--book{background:#0A0A0A;color:#fff}
.clubs-page .cc-btn--book:hover{background:var(--red)}
.clubs-page .cc-btn--joined{background:var(--lime);color:#0A0A0A}
.clubs-page .cc-btn--joined:hover{filter:brightness(.95)}
.clubs-page .cc-btn--full{background:var(--bg);color:var(--muted);cursor:not-allowed}

.clubs-page .empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:.9rem;background:var(--surface);border:1px dashed var(--border);border-radius:16px;margin-top:14px}
.clubs-page .empty-emoji{font-size:2rem;margin-bottom:10px;display:block}

.clubs-page .skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:clubsShimmer 1.4s ease infinite;border-radius:10px}
@keyframes clubsShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.clubs-page .skel-card{height:84px;margin-bottom:10px}

/* Dark-mode variable overrides (remap tokens) */
[data-theme="dark"] .clubs-page .pill.active{background:var(--red);color:#fff;border-color:var(--red)}
[data-theme="dark"] .clubs-page .cs-d{background:#F5F5F3}
[data-theme="dark"] .clubs-page .cl-d{background:#F5F5F3}
[data-theme="dark"] .clubs-page .ev--d{background:rgba(245,245,243,.08);color:var(--text);border-color:#F5F5F3}
[data-theme="dark"] .clubs-page .cc-btn--book{background:var(--red);color:#fff}
[data-theme="dark"] .clubs-page .cc-btn--book:hover{filter:brightness(.9);background:var(--red)}
[data-theme="dark"] .clubs-page .cal-today{background:var(--red)}
[data-theme="dark"] .clubs-page .st--dark{background:var(--surface-2);color:var(--text);border-color:var(--border)}
[data-theme="dark"] .clubs-page .st--dark .st-label,[data-theme="dark"] .clubs-page .st--dark .st-sub{color:var(--muted)}

@media(max-width:900px){.clubs-page .stats{grid-template-columns:1fr 1fr}}
@media(max-width:600px){
  .clubs-page .hdr{flex-direction:column;align-items:flex-start}
  .clubs-page .stats{grid-template-columns:1fr 1fr}
  .clubs-page .filters{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px}
  .clubs-page .pill{flex-shrink:0}
  .clubs-page .cc{flex-wrap:wrap}
  .clubs-page .cc-host{border-left:none;border-top:1px solid var(--border);width:100%;padding:8px 14px}
  .clubs-page .cc-right{width:100%;border-left:none;border-top:1px solid var(--border);flex-direction:row}
  .clubs-page .cc-btn{flex:1}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return "??"
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??"
  )
}

function dayLabel(starts: Date, now: Date): string {
  if (isSameDay(starts, now)) return "сегодня"
  if (isTomorrow(starts)) return "завтра"
  return format(starts, "d MMM", { locale: ru })
}

function weekdayIdx(d: Date): number {
  return (d.getDay() + 6) % 7 // Monday-first
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [stats, setStats] = useState<ClubsStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [weekCursor, setWeekCursor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())

  // Live clock so "сегодня"/"завтра" labels stay accurate past midnight.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const weekStart = useMemo(() => startOfWeek(weekCursor, { weekStartsOn: 1 }), [weekCursor])
  const weekEnd = useMemo(() => endOfDay(addDays(weekStart, 6)), [weekStart])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  // Load everything in parallel on mount.
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [clubsRes, statsRes] = await Promise.all([
        fetch("/api/clubs?scope=upcoming&limit=100", { cache: "no-store" }),
        fetch("/api/clubs/stats", { cache: "no-store" }),
      ])
      if (clubsRes.ok) {
        const data = (await clubsRes.json()) as { clubs: Club[] }
        setClubs(data.clubs ?? [])
      } else {
        toast.error("Не удалось загрузить клубы")
      }
      if (statsRes.ok) {
        const data = (await statsRes.json()) as ClubsStats
        setStats(data)
      }
      // stats may 401 for anon users; silently ignore.
    } catch (err) {
      console.error("[clubs page] load error:", err)
      toast.error("Не удалось загрузить данные")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter logic — all client-side so the user can flip instantly.
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      switch (filter) {
        case "all":
          return true
        case "speaking":
          return c.category === "speaking" || c.category === "business" || c.category === "career"
        case "debate":
          return c.category === "debate"
        case "wine":
          return c.category === "wine" || c.category === "movies"
        case "niche":
          return NICHE_CATEGORIES.includes(c.category)
        case "raw-rare": {
          const maxIdx = roastIdx(c.level_max, ROAST_LEVELS.length - 1)
          return maxIdx <= ROAST_LEVELS.indexOf("Rare")
        }
        case "medium-plus": {
          const minIdx = roastIdx(c.level_min, 0)
          return minIdx >= ROAST_LEVELS.indexOf("Medium")
        }
        default:
          return true
      }
    })
  }, [clubs, filter])

  const clubsThisWeek = useMemo(() => {
    return filteredClubs.filter((c) => {
      const d = new Date(c.starts_at)
      return d >= weekStart && d <= weekEnd
    })
  }, [filteredClubs, weekStart, weekEnd])

  const upcomingFromNow = useMemo(() => {
    return filteredClubs
      .filter((c) => new Date(c.starts_at) >= now && !c.cancelled_at)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }, [filteredClubs, now])

  // Group upcoming clubs by local day for the list view.
  const clubsByDay = useMemo(() => {
    const map = new Map<string, Club[]>()
    for (const c of upcomingFromNow) {
      const key = format(new Date(c.starts_at), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [upcomingFromNow])

  // ─── Mutations ──────────────────────────────────────────────────────────
  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleRegistration = useCallback(
    async (club: Club) => {
      if (busyIds.has(club.id)) return
      if (!club.is_user_registered && club.is_full) return

      setBusy(club.id, true)

      const wasRegistered = club.is_user_registered
      const endpoint = wasRegistered
        ? `/api/clubs/${club.id}/cancel`
        : `/api/clubs/${club.id}/register`

      // Optimistic update
      setClubs((prev) =>
        prev.map((c) =>
          c.id === club.id
            ? {
                ...c,
                is_user_registered: !wasRegistered,
                my_registration_status: wasRegistered ? "cancelled" : "registered",
                seats_taken: Math.max(0, c.seats_taken + (wasRegistered ? -1 : 1)),
                seats_remaining: Math.max(0, c.seats_remaining + (wasRegistered ? 1 : -1)),
                is_full: !wasRegistered
                  ? c.seats_taken + 1 >= c.max_seats
                  : false,
              }
            : c
        )
      )

      try {
        const res = await fetch(endpoint, { method: "POST" })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error || "Ошибка запроса")
        }
        toast.success(wasRegistered ? "Запись отменена" : "Ты записан на клуб!")
        // Refresh stats (next club / counts may have changed)
        fetch("/api/clubs/stats", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setStats(d))
          .catch(() => {})
      } catch (err) {
        // Revert
        setClubs((prev) =>
          prev.map((c) =>
            c.id === club.id
              ? {
                  ...c,
                  is_user_registered: wasRegistered,
                  my_registration_status: club.my_registration_status,
                  seats_taken: club.seats_taken,
                  seats_remaining: club.seats_remaining,
                  is_full: club.is_full,
                }
              : c
          )
        )
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : wasRegistered
              ? "Не удалось отменить запись"
              : "Не удалось записаться"
        )
      } finally {
        setBusy(club.id, false)
      }
    },
    [busyIds]
  )

  // ─── Calendar event → scroll to list card ───────────────────────────────
  const scrollToClub = useCallback((id: string) => {
    setHighlightId(id)
    const el = document.getElementById(`club-card-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    window.setTimeout(() => setHighlightId(null), 1600)
  }, [])

  // ─── Derived calendar-grid structure ────────────────────────────────────
  // Each row-bucket: first row whose hour ≥ club.starts_at.getHours()
  function bucketForHour(hour: number): number {
    for (let i = 0; i < CALENDAR_HOURS.length; i += 1) {
      if (hour <= CALENDAR_HOURS[i]) return i
    }
    return CALENDAR_HOURS.length - 1
  }

  const weekTitle = `${format(weekStart, "d", { locale: ru })} — ${format(addDays(weekStart, 6), "d MMMM yyyy", { locale: ru })}`

  function goPrev() { setWeekCursor((c) => addWeeks(c, -1)) }
  function goNext() { setWeekCursor((c) => addWeeks(c, 1)) }
  function goToday() { setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 })) }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="clubs-page">
      <style dangerouslySetInnerHTML={{ __html: CLUBS_CSS }} />

      <div className="hdr">
        <h1>Speaking <span className="gl">Clubs</span></h1>
      </div>
      <div className="hdr-sub">Все доступные клубы на платформе. Выбери тему — запишись — заговори.</div>

      {/* Filter pills */}
      <div className="filters" role="tablist" aria-label="Фильтр клубов">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>Все</FilterPill>
        <FilterPill active={filter === "speaking"} onClick={() => setFilter("speaking")}>🎙 Speaking</FilterPill>
        <FilterPill active={filter === "debate"} onClick={() => setFilter("debate")}>⚡ Debate</FilterPill>
        <FilterPill active={filter === "wine"} onClick={() => setFilter("wine")}>🍷 Wine</FilterPill>
        <FilterPill active={filter === "niche"} onClick={() => setFilter("niche")}>🎯 Niche</FilterPill>
        <FilterPill active={filter === "raw-rare"} onClick={() => setFilter("raw-rare")}>Raw–Rare</FilterPill>
        <FilterPill active={filter === "medium-plus"} onClick={() => setFilter("medium-plus")}>Medium+</FilterPill>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="st st--red">
          <div className="st-label">Эта неделя</div>
          <div className="st-val">{stats?.weekCount ?? (isLoading ? "…" : 0)}</div>
          <div className="st-sub">клубов доступно</div>
        </div>
        <div className="st">
          <div className="st-label">Ты посетил</div>
          <div className="st-val">{stats?.attendedThisMonth ?? (isLoading ? "…" : 0)}</div>
          <div className="st-sub">клубов за месяц</div>
        </div>
        <div className={`st ${stats?.nextClub ? "st--lime" : ""}`}>
          <div className="st-label">Ближайший</div>
          <div className="st-val">
            {stats?.nextClub ? (
              <span className="gl">{format(new Date(stats.nextClub.starts_at), "HH:mm")}</span>
            ) : (
              "—"
            )}
          </div>
          <div className="st-sub">
            {stats?.nextClub
              ? `${categoryTag(stats.nextClub.club_type)} · ${dayLabel(new Date(stats.nextClub.starts_at), now)}`
              : "нет записей"}
          </div>
        </div>
        <div className="st st--dark">
          <div className="st-label">XP за клубы</div>
          <div className="st-val">+{stats?.xpThisMonth ?? 0}</div>
          <div className="st-sub">за этот месяц</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="cal">
        <div className="cal-head">
          <div className="cal-nav">
            <button type="button" className="cal-arr" onClick={goPrev} aria-label="Предыдущая неделя">←</button>
            <div className="cal-title">{weekTitle}</div>
            <button type="button" className="cal-arr" onClick={goNext} aria-label="Следующая неделя">→</button>
          </div>
          <button type="button" className="cal-today" onClick={goToday}>Сегодня</button>
        </div>

        <div className="cal-legend">
          <div className="cl"><div className="cl-dot cl-s" />Speaking Club</div>
          <div className="cl"><div className="cl-dot cl-d" />Debate Club</div>
          <div className="cl"><div className="cl-dot cl-w" />Wine Club</div>
          <div className="cl"><div className="cl-dot cl-n" />Niche Club</div>
        </div>

        <div className="cg-wrap">
          <div className="cg">
            <div className="cg-corner" />
            {weekDays.map((d) => (
              <div key={d.toISOString()} className={`cg-dh${isSameDay(d, now) ? " cg-dh--today" : ""}`}>
                <div className="cg-dn">{format(d, "EEEEEE", { locale: ru })}</div>
                <div className="cg-dd">{format(d, "d")}</div>
              </div>
            ))}

            {CALENDAR_HOURS.map((hour, rowIdx) => (
              <CalendarRow
                key={hour}
                hour={hour}
                rowIdx={rowIdx}
                weekDays={weekDays}
                clubs={clubsThisWeek}
                bucketForHour={bucketForHour}
                onEventClick={scrollToClub}
                highlightId={highlightId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* List by days */}
      {isLoading ? (
        <>
          <div className="sec-title">Загрузка…</div>
          <div className="skeleton skel-card" />
          <div className="skeleton skel-card" />
          <div className="skeleton skel-card" />
        </>
      ) : upcomingFromNow.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">🎙</span>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Пока нет ни одного клуба</div>
          <div style={{ fontSize: ".78rem" }}>
            Попробуй убрать фильтры или загляни позже — расписание обновляется каждую неделю.
          </div>
        </div>
      ) : (
        // Iterate over the map so days stay chronologically sorted.
        Array.from(clubsByDay.entries()).map(([key, dayClubs], i) => {
          const d = new Date(`${key}T00:00:00`)
          const today = isSameDay(d, now)
          const tomorrow = isTomorrow(d)
          return (
            <div key={key}>
              <div
                className="sec-title"
                style={i === 0 ? undefined : { marginTop: 16 }}
              >
                {format(d, "EEEE, d MMMM", { locale: ru })}
                {today ? <span className="badge badge--today">Сегодня</span> : null}
                {tomorrow ? <span className="badge badge--tm">Завтра</span> : null}
              </div>
              {dayClubs.map((c) => (
                <ClubCard
                  key={c.id}
                  club={c}
                  busy={busyIds.has(c.id)}
                  onToggle={() => toggleRegistration(c)}
                  highlight={highlightId === c.id}
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`pill${active ? " active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CalendarRow({
  hour,
  rowIdx,
  weekDays,
  clubs,
  bucketForHour,
  onEventClick,
  highlightId,
}: {
  hour: number
  rowIdx: number
  weekDays: Date[]
  clubs: Club[]
  bucketForHour: (h: number) => number
  onEventClick: (id: string) => void
  highlightId: string | null
}) {
  const label = `${String(hour).padStart(2, "0")}:00`
  return (
    <>
      <div className="cg-t">{label}</div>
      {weekDays.map((day) => {
        const dayIdx = weekdayIdx(day)
        const cellClubs = clubs.filter((c) => {
          const d = new Date(c.starts_at)
          return (
            weekdayIdx(d) === dayIdx &&
            isSameDay(d, day) &&
            bucketForHour(d.getHours()) === rowIdx
          )
        })
        const first = cellClubs[0]
        return (
          <div key={`${day.toISOString()}-${hour}`} className="cg-c">
            {first ? (
              <CalendarEvent
                club={first}
                onClick={() => onEventClick(first.id)}
                highlight={highlightId === first.id}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

function CalendarEvent({
  club,
  onClick,
  highlight,
}: {
  club: Club
  onClick: () => void
  highlight: boolean
}) {
  const group = categoryGroup(club.category)
  const occupancy = club.max_seats > 0 ? club.seats_taken / club.max_seats : 0
  const soon = !club.is_full && occupancy >= 0.8
  const height = Math.max(44, Math.min(64, (club.duration_min / 60) * 60))
  const cls = [
    "ev",
    `ev--${group}`,
    club.is_full ? "ev--full" : "",
    soon ? "ev--soon" : "",
    highlight ? "ev--highlight" : "",
  ].filter(Boolean).join(" ")
  const warn = club.seats_remaining <= 1 && !club.is_full
  return (
    <button type="button" className={cls} style={{ height }} onClick={onClick} aria-label={`${club.topic}, ${format(new Date(club.starts_at), "HH:mm")}`}>
      <div className="ev-n">{club.cover_emoji ? `${club.cover_emoji} ` : ""}{club.topic}</div>
      <div className="ev-seats">
        {warn || club.is_full
          ? <b>{club.seats_taken}/{club.max_seats}{warn && !club.is_full ? "!" : ""}</b>
          : `${club.seats_taken}/${club.max_seats}`}
      </div>
    </button>
  )
}

function ClubCard({
  club,
  busy,
  onToggle,
  highlight,
}: {
  club: Club
  busy: boolean
  onToggle: () => void
  highlight: boolean
}) {
  const group = categoryGroup(club.category)
  const dt = new Date(club.starts_at)
  const dotCount = Math.max(club.max_seats, 1)
  const seatWarn = club.seats_remaining <= 1 && !club.is_full
  const primaryHost = club.club_hosts?.find((h) => h.profiles) ?? null
  const host = primaryHost?.profiles
  const role = primaryHost?.role

  let btn: React.ReactNode
  if (club.is_user_registered) {
    btn = (
      <button
        type="button"
        className="cc-btn cc-btn--joined"
        onClick={onToggle}
        disabled={busy}
        aria-label="Отменить запись"
      >
        {busy ? "…" : "✓ Записан!"}
      </button>
    )
  } else if (club.is_full) {
    btn = (
      <button type="button" className="cc-btn cc-btn--full" disabled>
        Мест нет
      </button>
    )
  } else {
    btn = (
      <button
        type="button"
        className="cc-btn cc-btn--book"
        onClick={onToggle}
        disabled={busy}
      >
        {busy ? "…" : "Записаться"}
      </button>
    )
  }

  return (
    <div
      id={`club-card-${club.id}`}
      className={`cc${highlight ? " cc--highlight" : ""}`}
    >
      <div className={`cc-strip cs-${group}`} />
      <div className="cc-time">
        <div className="cc-tv">{format(dt, "HH:mm")}</div>
        <div className="cc-td">{club.duration_min} мин</div>
        {club.xp_reward > 0 ? <div className="cc-xp">+{club.xp_reward} XP</div> : null}
      </div>
      <div className="cc-body">
        <div className="cc-topic">
          {club.cover_emoji ? `${club.cover_emoji} ` : ""}{club.topic}
        </div>
        {club.description ? (
          <div className="cc-desc">{club.description}</div>
        ) : null}
        <div className="cc-tags">
          <span className="cc-tag cc-tag--lvl">{levelTag(club.level_min, club.level_max)}</span>
          <span className="cc-tag">{categoryTag(club.category)}</span>
          {club.badge ? <span className="cc-tag">{club.badge}</span> : null}
        </div>
      </div>
      {host ? (
        <div className="cc-host">
          <div className="cc-ha">
            {host.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.avatar_url} alt={host.full_name ?? ""} />
            ) : (
              host.initials || getInitials(host.full_name)
            )}
          </div>
          <div>
            <div className="cc-hn">{host.full_name ?? "Ведущий"}</div>
            <div className="cc-hr">{role ?? "Ведущий"}</div>
          </div>
        </div>
      ) : null}
      <div className="cc-right">
        <div className="cc-seats">
          <div className="cc-seats-dots">
            {Array.from({ length: dotCount }).map((_, i) => (
              <div key={i} className={`sd ${i < club.seats_taken ? "sd-t" : "sd-f"}`} />
            ))}
          </div>
          {seatWarn || club.is_full ? (
            <span className="cc-seats-warn">
              {club.seats_taken}/{club.max_seats}{seatWarn && !club.is_full ? "!" : ""}
            </span>
          ) : (
            `${club.seats_taken}/${club.max_seats}`
          )}
        </div>
        {btn}
      </div>
    </div>
  )
}
