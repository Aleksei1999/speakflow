// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

type StudentItem = {
  id: string
  full_name: string
  avatar_url: string | null
  email: string | null
  english_level: string | null
  total_xp: number
  current_streak: number
  lessons_completed: number
  last_lesson_at: string | null
  next_lesson_id: string | null
  next_lesson_at: string | null
  next_lesson_topic: string
  course_progress_pct: number
  needs_attention: boolean
}

type Snapshot = {
  students: StudentItem[]
  counts: Record<string, number>
  stats: {
    total: number
    active_today: number
    avg_progress: number
    needs_attention: number
  }
}

type LevelFilterKey = "all" | "A1-A2" | "B1" | "B2" | "C1+"

const LEVEL_FILTERS: { key: LevelFilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "A1-A2", label: "A1-A2" },
  { key: "B1", label: "B1" },
  { key: "B2", label: "B2" },
  { key: "C1+", label: "C1+" },
]

// Maps a UI-level tab to the set of CEFR levels it represents
const LEVEL_FILTER_MAP: Record<LevelFilterKey, string[]> = {
  all: [],
  "A1-A2": ["A1", "A2"],
  B1: ["B1"],
  B2: ["B2"],
  "C1+": ["C1", "C2"],
}

function initialsOf(name: string): string {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Deterministic avatar colour via hash(full_name) % 4 → red | lime | dark | (default)
function avatarClass(name: string): string {
  if (!name) return ""
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const bucket = Math.abs(hash) % 4
  if (bucket === 0) return "red"
  if (bucket === 1) return "lime"
  if (bucket === 2) return "dark"
  return ""
}

// Level-pill class mapping (exact from prototype)
function levelPillClass(level: string | null): string {
  switch (level) {
    case "A1":
      return "level-pill rare"
    case "A2":
      return "level-pill mrare"
    case "B1":
      return "level-pill medium"
    case "B2":
      return "level-pill mwell"
    case "C1":
    case "C2":
      return "level-pill welldone"
    default:
      return "level-pill"
  }
}

function levelPillLabel(level: string | null): string {
  switch (level) {
    case "A1":
      return "Rare · A1"
    case "A2":
      return "M.Rare · A2"
    case "B1":
      return "Medium · B1"
    case "B2":
      return "M.Well · B2"
    case "C1":
      return "Well-done · C1"
    case "C2":
      return "Well-done · C2"
    default:
      return "Не указан"
  }
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatNextLesson(iso: string | null): {
  primary: string
  today: boolean
} {
  if (!iso) return { primary: "", today: false }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { primary: "", today: false }
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const hhmm = format(d, "HH:mm", { locale: ru })
  if (isSameCalendarDay(d, now)) {
    return { primary: `Сегодня, ${hhmm}`, today: true }
  }
  if (isSameCalendarDay(d, tomorrow)) {
    return { primary: `Завтра, ${hhmm}`, today: false }
  }
  return { primary: format(d, "EEEEEE, HH:mm", { locale: ru }), today: false }
}

// --- Icons (inline SVG; no lucide to keep scoped to .tch-std) ---
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}

export default function TeacherStudentsClient({ initial }: { initial: Snapshot }) {
  const [data, setData] = useState<Snapshot>(initial)
  const [levelFilter, setLevelFilter] = useState<LevelFilterKey>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(false)

  // Debounce search (300ms per spec)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Fetch with raw CEFR level(s) expanded from the UI tab.
  // We keep the UI grouping (A1-A2 and C1+) on the client: we fetch
  // level=all and filter locally — simpler and avoids two-level semantics
  // server-side.
  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const params = new URLSearchParams({ level: "all" })
        if (debouncedSearch) params.set("q", debouncedSearch)
        const res = await fetch(`/api/teacher/students?${params.toString()}`, {
          cache: "no-store",
        })
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login"
          return
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j?.error || "Не удалось загрузить учеников")
          return
        }
        const json = await res.json()
        setData({
          students: Array.isArray(json.students) ? json.students : [],
          counts: {
            all: 0,
            A1: 0,
            A2: 0,
            B1: 0,
            B2: 0,
            C1: 0,
            C2: 0,
            ...(json.counts ?? {}),
          },
          stats: {
            total: 0,
            active_today: 0,
            avg_progress: 0,
            needs_attention: 0,
            ...(json.stats ?? {}),
          },
        })
      } catch {
        toast.error("Сетевая ошибка")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [debouncedSearch]
  )

  // Refetch when debounced search changes (skip first mount — SSR snapshot)
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      if (debouncedSearch === "") return
    }
    reload()
  }, [reload, debouncedSearch])

  // Client-side level filter
  const filteredStudents = useMemo(() => {
    if (levelFilter === "all") return data.students
    const set = new Set(LEVEL_FILTER_MAP[levelFilter])
    return data.students.filter(
      (s) => s.english_level && set.has(s.english_level)
    )
  }, [data.students, levelFilter])

  // Count per UI tab (sums of underlying CEFR counts)
  const tabCounts: Record<LevelFilterKey, number> = useMemo(() => {
    const c = data.counts || {}
    return {
      all: c.all || 0,
      "A1-A2": (c.A1 || 0) + (c.A2 || 0),
      B1: c.B1 || 0,
      B2: c.B2 || 0,
      "C1+": (c.C1 || 0) + (c.C2 || 0),
    }
  }, [data.counts])

  const s = data.stats

  function handleAddStudent() {
    toast("Скоро", { description: "Добавление учеников появится в ближайшее время." })
  }

  return (
    <>
      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Всего учеников</div>
          <div className="value">{s.total}</div>
          <div className="change">{s.total === 0 ? "пока никого" : "активных"}</div>
        </div>
        <div className="stat-card accent">
          <div className="label">Активных сегодня</div>
          <div className="value">{s.active_today}</div>
          <div className="change">
            {s.active_today > 0
              ? `${s.active_today} уроков сегодня`
              : "нет уроков сегодня"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Средний прогресс</div>
          <div className="value">
            {s.avg_progress}
            <small>%</small>
          </div>
          <div className="change">по всем ученикам</div>
        </div>
        <div className="stat-card">
          <div className="label">Нужно внимание</div>
          <div className="value">{s.needs_attention}</div>
          <div className={`change${s.needs_attention > 0 ? " warning" : " positive"}`}>
            {s.needs_attention > 0 ? "пропустили уроки" : "всё в порядке"}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={levelFilter === f.key ? "active" : ""}
              onClick={() => setLevelFilter(f.key)}
            >
              {f.label}
              {tabCounts[f.key] > 0 ? (
                <span className="pill-count">{tabCounts[f.key]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={handleAddStudent}>
          + Добавить ученика
        </button>
      </div>

      {/* LIST */}
      {loading && filteredStudents.length === 0 ? (
        <div className="empty-state">
          <b>Загрузка...</b>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">
          <b>
            {levelFilter === "all" && !debouncedSearch
              ? "У вас пока нет учеников"
              : "Никого не найдено"}
          </b>
          {levelFilter === "all" && !debouncedSearch
            ? "Ученики появятся здесь после первого общего урока."
            : "Попробуйте изменить фильтры или поиск."}
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>Список учеников</h3>
            <div className="sort-label">Сортировка: по ближайшему уроку ↑</div>
          </div>
          <div className="card-body">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Уровень</th>
                  <th>Прогресс курса</th>
                  <th>Серия</th>
                  <th>Ближайший урок</th>
                  <th style={{ textAlign: "right" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => (
                  <StudentRow key={st.id} student={st} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function StudentRow({ student }: { student: StudentItem }) {
  const avClass = avatarClass(student.full_name)
  const nextLesson = formatNextLesson(student.next_lesson_at)

  // Progress-fill: use .lime accent for low progress (under 50%) like prototype
  const progressClass = student.course_progress_pct < 50 ? "progress-fill lime" : "progress-fill"

  // Decide play-button target: internal teacher lesson route if next lesson exists
  const hasPlayTarget = !!student.next_lesson_id
  const playHref = hasPlayTarget
    ? `/teacher/lesson/${student.next_lesson_id}`
    : undefined

  // Mailto for message button
  const mailtoHref = student.email
    ? `mailto:${student.email}?subject=${encodeURIComponent("Сообщение от преподавателя")}`
    : undefined

  return (
    <tr>
      <td>
        <div className="st-user">
          {student.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="st-avatar"
              src={student.avatar_url}
              alt={student.full_name}
            />
          ) : (
            <div className={`st-avatar ${avClass}`.trim()}>
              {initialsOf(student.full_name) || "?"}
            </div>
          )}
          <div>
            <div className="st-name">{student.full_name}</div>
            {student.email ? <div className="st-email">{student.email}</div> : null}
          </div>
        </div>
      </td>
      <td>
        <span className={levelPillClass(student.english_level)}>
          {levelPillLabel(student.english_level)}
        </span>
      </td>
      <td>
        <div className="progress-mini">
          <div className="progress-track">
            <div
              className={progressClass}
              style={{ width: `${student.course_progress_pct}%` }}
            />
          </div>
          <div className="progress-label">{student.course_progress_pct}%</div>
        </div>
      </td>
      <td>
        {student.needs_attention && student.current_streak === 0 ? (
          <span className="streak-cell" style={{ color: "#F59E0B" }}>
            ⚠ 0
          </span>
        ) : (
          <span className="streak-cell">
            <span className="fire">🔥</span>
            {student.current_streak}
          </span>
        )}
      </td>
      <td>
        {nextLesson.primary ? (
          <div className={`next-lesson${nextLesson.today ? " today" : ""}`}>
            <strong>{nextLesson.primary}</strong>
            <span>{student.next_lesson_topic}</span>
          </div>
        ) : (
          <span className="muted-dash">—</span>
        )}
      </td>
      <td>
        <div className="action-btns">
          {hasPlayTarget && playHref ? (
            <Link
              className={`action-btn${nextLesson.today ? " primary" : ""}`}
              href={playHref}
              title="Начать урок"
            >
              <PlayIcon />
            </Link>
          ) : (
            <button
              type="button"
              className="action-btn disabled"
              title="Нет запланированного урока"
              aria-disabled
            >
              <PlayIcon />
            </button>
          )}
          {mailtoHref ? (
            <a
              className={`action-btn${student.needs_attention ? " primary" : ""}`}
              href={mailtoHref}
              title="Написать"
            >
              <MessageIcon />
            </a>
          ) : (
            <button
              type="button"
              className="action-btn disabled"
              title="Нет email"
              aria-disabled
            >
              <MessageIcon />
            </button>
          )}
          <button
            type="button"
            className="action-btn"
            title="Профиль"
            onClick={() => toast("Скоро", { description: "Профиль ученика появится позже." })}
          >
            <DotsIcon />
          </button>
        </div>
      </td>
    </tr>
  )
}
