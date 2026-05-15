"use client"

import "@/styles/dashboard/student-clubs.css"

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
  const [now, setNow] = useState<Date>(() => new Date())
  // mounted-gate: now/weekCursor initialized via new Date(), а new Date()
  // на server и client возвращает разные значения → format/dayLabel в JSX
  // даёт разный текст → React error #418. До mount возвращаем skeleton.
  const [mounted, setMounted] = useState(false)

  // Live clock so "сегодня"/"завтра" labels stay accurate past midnight.
  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    setWeekCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))
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
    const nowMs = now.getTime()
    return filteredClubs
      .filter((c) => {
        if (c.cancelled_at) return false
        const startMs = new Date(c.starts_at).getTime()
        const durMs = (c.duration_min || 60) * 60_000
        // Keep clubs that are in the future OR currently running.
        return startMs + durMs > nowMs
      })
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
  // До mount страница time-зависимая (now / weekCursor / format с локалью)
  // → SSR и client дадут разный HTML, отсюда React #418. Skeleton до mount,
  // полный рендер — после.
  if (!mounted) {
    return (
      <div className="clubs-page">
        <div className="hdr">
          <h1>Speaking <span className="gl">Clubs</span></h1>
        </div>
        <div className="hdr-sub">Загружаем клубы…</div>
      </div>
    )
  }

  return (
    <div className="clubs-page">

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

  // Compute access window for the "Зайти" CTA — registered students get a
  // join button when the room is live (5 min before → end + 5 min).
  const startMs = new Date(club.starts_at).getTime()
  const durMs = (club.duration_min || 60) * 60_000
  const openMs = startMs - 5 * 60_000
  const closeMs = startMs + durMs + 5 * 60_000
  const nowMsLocal = Date.now()
  const isLive = nowMsLocal >= openMs && nowMsLocal <= closeMs
  const isExpired = nowMsLocal > closeMs

  let btn: React.ReactNode
  if (club.is_user_registered && isLive) {
    btn = (
      <a
        href={`/club/${club.id}/room`}
        className="cc-btn cc-btn--book"
        style={{ textAlign: "center" }}
      >
        🎙 Зайти в клуб
      </a>
    )
  } else if (club.is_user_registered && isExpired) {
    btn = (
      <button type="button" className="cc-btn cc-btn--full" disabled>
        Завершён
      </button>
    )
  } else if (club.is_user_registered) {
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
