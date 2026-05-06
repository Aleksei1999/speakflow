// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import CreateHomeworkModal from "./CreateHomeworkModal"
import ReviewHomeworkModal from "./ReviewHomeworkModal"

type Attachment = {
  name: string
  url: string
  size?: number
  mime?: string
}

type HomeworkItem = {
  id: string
  student_id: string
  student_name: string
  student_avatar: string | null
  student_level: string | null
  lesson_id: string | null
  lesson_at: string | null
  title: string
  description: string | null
  due_date: string
  status: "pending" | "in_progress" | "submitted" | "reviewed" | "overdue"
  ui_status: "submitted" | "assigned" | "overdue" | "reviewed"
  submission_text: string | null
  teacher_feedback: string | null
  grade: number | null
  score_10: number | null
  submitted_at: string | null
  reviewed_at: string | null
  reminders_count: number
  last_reminded_at: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
}

type Snapshot = {
  homework: HomeworkItem[]
  counts: Record<string, number>
  stats: { last_submitted_at: string | null; avg_score_10: number | null }
}

type FilterKey = "all" | "submitted" | "assigned" | "overdue" | "reviewed"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "submitted", label: "На проверке" },
  { key: "assigned", label: "Выдано" },
  { key: "overdue", label: "Просрочено" },
  { key: "reviewed", label: "Проверено" },
]

function initialsOf(name: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Stable avatar color from id → red/lime/dark/neutral
function avatarClass(id: string): string {
  if (!id) return ""
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  const bucket = n % 4
  if (bucket === 0) return "red"
  if (bucket === 1) return "lime"
  if (bucket === 2) return "dark"
  return ""
}

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  if (Math.abs(diffMs) < 60 * 1000) return "только что"
  return formatDistanceToNow(d, { addSuffix: true, locale: ru })
}

function formatDueMeta(iso: string, ui: string): { text: string; tone: "normal" | "warn" | "over" } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { text: "", tone: "normal" }
  const now = Date.now()
  const diffMs = d.getTime() - now
  const dayMs = 24 * 60 * 60 * 1000
  if (ui === "overdue") {
    const days = Math.max(1, Math.floor(-diffMs / dayMs))
    return { text: `Просрочено на ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`, tone: "over" }
  }
  if (diffMs < 0) {
    return { text: `Дедлайн был ${format(d, "d MMMM", { locale: ru })}`, tone: "normal" }
  }
  if (diffMs < dayMs) {
    return { text: "Дедлайн сегодня", tone: "warn" }
  }
  if (diffMs < 2 * dayMs) {
    return { text: "Дедлайн завтра", tone: "warn" }
  }
  const days = Math.ceil(diffMs / dayMs)
  return { text: `Дедлайн через ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`, tone: "normal" }
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export default function TeacherHomeworkClient({ initial }: { initial: Snapshot }) {
  const [data, setData] = useState<Snapshot>(initial)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(false)

  // Hydration guard для time-зависимых рендеров (formatRelative / formatDueMeta).
  // На сервере и клиенте Date.now() разный → расхождение HTML → React #418.
  // С `mounted=true` time-метки появляются только после client mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const params = new URLSearchParams({ status: filter, sort: "recent" })
        if (debouncedSearch) params.set("q", debouncedSearch)
        const res = await fetch(`/api/teacher/homework?${params.toString()}`, {
          cache: "no-store",
        })
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login"
          return
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error(j?.error || "Не удалось загрузить задания")
          return
        }
        const json = await res.json()
        setData({
          homework: Array.isArray(json.homework) ? json.homework : [],
          counts: { all: 0, submitted: 0, assigned: 0, overdue: 0, reviewed: 0, ...(json.counts ?? {}) },
          stats: {
            last_submitted_at: json.stats?.last_submitted_at ?? null,
            avg_score_10:
              typeof json.stats?.avg_score_10 === "number"
                ? json.stats.avg_score_10
                : null,
          },
        })
      } catch (err) {
        toast.error("Сетевая ошибка")
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [filter, debouncedSearch]
  )

  // Refetch when filter or debounced search changes — skip the very first mount
  // since we already have SSR snapshot for status='all' with no search.
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      if (filter === "all" && debouncedSearch === "") return
    }
    reload()
  }, [reload, filter, debouncedSearch])

  const c = data.counts

  const submittedToday = useMemo(() => {
    return data.homework.filter((h) => {
      if (!h.submitted_at) return false
      const d = new Date(h.submitted_at)
      const now = new Date()
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      )
    }).length
  }, [data.homework])

  const avgDaysToSubmit = useMemo(() => {
    // Average lead-time from created_at to due_date for active assignments
    const active = data.homework.filter((h) => h.ui_status === "assigned")
    if (active.length === 0) return null
    const sum = active.reduce((acc, h) => {
      const created = new Date(h.created_at).getTime()
      const due = new Date(h.due_date).getTime()
      return acc + Math.max(0, (due - created) / (24 * 60 * 60 * 1000))
    }, 0)
    return Math.round(sum / active.length)
  }, [data.homework])

  async function remindStudent(hwId: string) {
    try {
      const res = await fetch(`/api/teacher/homework/${hwId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remind" }),
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось отправить напоминание")
        return
      }
      toast.success("Напоминание отправлено")
      reload(true)
    } catch {
      toast.error("Сетевая ошибка")
    }
  }

  async function deleteHomework(hwId: string) {
    if (!confirm("Удалить задание?")) return
    try {
      const res = await fetch(`/api/teacher/homework/${hwId}`, {
        method: "DELETE",
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось удалить задание")
        return
      }
      toast.success("Удалено")
      reload(true)
    } catch {
      toast.error("Сетевая ошибка")
    }
  }

  const items = data.homework

  return (
    <>
      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="label">Требуют проверки</div>
          <div className="value">{c.submitted || 0}</div>
          <div className="change">
            {submittedToday > 0
              ? `${submittedToday} сдан${submittedToday === 1 ? "о" : "ы"} сегодня`
              : "новых за сегодня нет"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Выдано активно</div>
          <div className="value">{c.assigned || 0}</div>
          <div className="change">
            {avgDaysToSubmit !== null
              ? `средн. срок: ${avgDaysToSubmit} ${avgDaysToSubmit === 1 ? "день" : avgDaysToSubmit < 5 ? "дня" : "дней"}`
              : "без активных"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Просрочено</div>
          <div className="value">{c.overdue || 0}</div>
          <div className={`change${(c.overdue || 0) > 0 ? " warning" : ""}`}>
            {(c.overdue || 0) > 0 ? "требуют напоминания" : "всё в порядке"}
          </div>
        </div>
        <div className="stat-card dark">
          <div className="label">Средний балл</div>
          <div className="value">
            {data.stats.avg_score_10 !== null
              ? data.stats.avg_score_10.toString().replace(".", ",")
              : "—"}
            <small>/10</small>
          </div>
          <div className="change">
            {data.stats.avg_score_10 !== null ? "по проверенным" : "пока нет оценок"}
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Поиск по ученику или теме..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "active" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {(c[f.key] || 0) > 0 ? (
                <span className="pill-count">{c[f.key] || 0}</span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreateOpen(true)}
        >
          + Создать задание
        </button>
      </div>

      {/* LIST */}
      {loading && items.length === 0 ? (
        <div className="empty-state"><b>Загрузка...</b></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <b>
            {filter === "all"
              ? "Пока нет заданий"
              : filter === "submitted"
              ? "Ничего не ждёт проверки"
              : filter === "assigned"
              ? "Нет активных заданий"
              : filter === "overdue"
              ? "Нет просроченных заданий"
              : "Нет проверенных заданий"}
          </b>
          Нажмите «Создать задание», чтобы выдать ДЗ ученику.
        </div>
      ) : (
        <div className="hw-list">
          {items.map((h) => (
            <HomeworkCard
              key={h.id}
              hw={h}
              mounted={mounted}
              onReview={() => setReviewId(h.id)}
              onRemind={() => remindStudent(h.id)}
              onDelete={() => deleteHomework(h.id)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      {createOpen ? (
        <CreateHomeworkModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            reload()
          }}
        />
      ) : null}

      {reviewId ? (
        <ReviewHomeworkModal
          homeworkId={reviewId}
          open={!!reviewId}
          onClose={() => setReviewId(null)}
          onUpdated={() => {
            setReviewId(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------
// Single homework card
// ---------------------------------------------------------------
function HomeworkCard({
  hw,
  mounted,
  onReview,
  onRemind,
  onDelete,
}: {
  hw: HomeworkItem
  mounted: boolean
  onReview: () => void
  onRemind: () => void
  onDelete: () => void
}) {
  const cardClass =
    hw.ui_status === "submitted"
      ? "pending"
      : hw.ui_status === "overdue"
      ? "overdue"
      : hw.ui_status === "reviewed"
      ? "graded"
      : ""

  const dueMeta = mounted ? formatDueMeta(hw.due_date, hw.ui_status) : { text: "", tone: "normal" as const }

  const score = hw.score_10 ?? (hw.grade !== null ? Number(hw.grade) / 10 : null)
  const scoreClass =
    score === null ? "" : score >= 8 ? "high" : score < 5 ? "low" : ""

  return (
    <div className={`hw-card ${cardClass}`}>
      <div className="hw-student">
        {hw.student_avatar ? (
          <img
            className="hw-avatar"
            src={hw.student_avatar}
            alt={hw.student_name}
          />
        ) : (
          <div className={`hw-avatar ${avatarClass(hw.student_id)}`}>
            {initialsOf(hw.student_name) || "?"}
          </div>
        )}
        <div className="hw-student-info">
          <strong>{hw.student_name}</strong>
          {hw.student_level ? <span>{hw.student_level}</span> : null}
        </div>
      </div>

      <div className="hw-body">
        <div className="hw-title">{hw.title}</div>
        <div className="hw-meta">
          {hw.ui_status === "submitted" && hw.submitted_at ? (
            <span>
              <b>Сдано</b> {mounted ? formatRelative(hw.submitted_at) : ""}
            </span>
          ) : null}
          {hw.ui_status === "reviewed" && hw.reviewed_at ? (
            <span>
              <b>Проверено</b>{" "}
              {format(new Date(hw.reviewed_at), "d MMMM", { locale: ru })}
            </span>
          ) : null}
          {dueMeta.text && hw.ui_status !== "reviewed" ? (
            <span
              className={
                dueMeta.tone === "warn"
                  ? "deadline-warn"
                  : dueMeta.tone === "over"
                  ? "deadline-over"
                  : ""
              }
            >
              {dueMeta.tone === "over" ? (
                <b>{dueMeta.text}</b>
              ) : (
                dueMeta.text
              )}
            </span>
          ) : null}
          {hw.ui_status === "assigned" && hw.created_at ? (
            <span>
              Выдано {mounted ? formatRelative(hw.created_at) : ""}
            </span>
          ) : null}
          {hw.ui_status === "reviewed" && hw.teacher_feedback ? (
            <span>Фидбэк оставлен</span>
          ) : null}
          {hw.reminders_count > 0 && hw.ui_status !== "reviewed" ? (
            <span>Напоминаний: {hw.reminders_count}</span>
          ) : null}
        </div>
        {hw.attachments && hw.attachments.length > 0 ? (
          <div className="hw-attached">
            {hw.attachments.slice(0, 4).map((a, i) => (
              <a
                key={i}
                className="chip"
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                title={a.name}
              >
                <PaperclipIcon />
                {a.name}
              </a>
            ))}
            {hw.attachments.length > 4 ? (
              <span className="chip">+{hw.attachments.length - 4}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="hw-actions">
        {hw.ui_status === "submitted" ? (
          <>
            <span className="hw-status hw-status-pending">на проверке</span>
            <button type="button" className="btn btn-red" onClick={onReview}>
              Проверить
            </button>
          </>
        ) : hw.ui_status === "overdue" ? (
          <>
            <span className="hw-status hw-status-overdue">просрочено</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRemind}>
              Напомнить
            </button>
          </>
        ) : hw.ui_status === "reviewed" ? (
          <>
            {score !== null ? (
              <div className={`hw-score ${scoreClass}`}>
                <strong>
                  {Number.isInteger(score) ? score : score.toFixed(1).replace(".", ",")}/10
                </strong>
                <span>оценка</span>
              </div>
            ) : null}
            <span className="hw-status hw-status-graded">✓ проверено</span>
          </>
        ) : (
          <>
            <span className="hw-status hw-status-assigned">выдано</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onReview}>
              Открыть
            </button>
          </>
        )}
        {hw.ui_status !== "submitted" && hw.ui_status !== "reviewed" ? (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            title="Удалить"
            onClick={onDelete}
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )
}
