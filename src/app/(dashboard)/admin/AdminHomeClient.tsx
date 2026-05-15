// @ts-nocheck
"use client"

import "@/styles/dashboard/admin-home.css"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

type AdminStats = {
  students_active: number
  students_delta_week: number
  apps_today: number
  apps_delta_day: number
  teacher_applications_new: number
  lessons_today: number
  live_now: number
  open_tickets: number
  tickets_urgent: number
  signups_week: number[]
  signups_total: number
  conversion_trial: number
  conversion_paid: number
}

type TeacherApplication = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  contact: string | null
  notes: string | null
  status: "new" | "in_review" | "approved" | "rejected" | "archived"
  created_at: string
}

type SupportThread = {
  id: string
  subject: string
  student_name: string
  student_level: string | null
  priority: "low" | "medium" | "high"
  status: "open" | "pending" | "resolved" | "closed"
  last_message_at: string
  created_at: string
}

type RecentStudent = {
  id: string
  full_name: string
  level: string | null
  goal: string | null
  created_at: string
}

type Props = {
  fullName: string
  initial: {
    stats: AdminStats
    applications: TeacherApplication[]
    tickets: SupportThread[]
    students: RecentStudent[]
  }
}

const AVATAR_STYLES = ["red", "", "lime", "dark", ""]

function initialsOf(name: string): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function timeAgoRu(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    if (Number.isNaN(d)) return ""
    const m = Math.round(diff / 60000)
    if (m < 1) return "сейчас"
    if (m < 60) return `${m} мин`
    const h = Math.round(m / 60)
    if (h < 24) return `${h} ч`
    const dd = Math.round(h / 24)
    return `${dd} дн`
  } catch {
    return ""
  }
}

function levelPillClass(level: string | null): string {
  if (!level) return ""
  const l = level.toLowerCase()
  if (l.includes("a1") || l.includes("beginner")) return "rare"
  if (l.includes("a2") || l.includes("elem")) return "mrare"
  if (l.includes("b1") || l.includes("interm")) return "medium"
  if (l.includes("b2")) return "medium"
  if (l.includes("c1") || l.includes("c2") || l.includes("adv")) return "welldone"
  return ""
}

function levelPillLabel(level: string | null): string {
  if (!level) return "—"
  return level
}

function avatarClassByIndex(i: number): string {
  return AVATAR_STYLES[i % AVATAR_STYLES.length]
}

function appStatusLabel(s: string): { cls: string; text: string } {
  switch (s) {
    case "new":
      return { cls: "app-status-new", text: "новая" }
    case "in_review":
      return { cls: "app-status-pending", text: "на рассмотрении" }
    case "approved":
      return { cls: "app-status-done", text: "✓ одобрена" }
    case "rejected":
      return { cls: "app-status-pending", text: "отклонена" }
    case "archived":
      return { cls: "app-status-pending", text: "архив" }
    default:
      return { cls: "app-status-pending", text: s || "—" }
  }
}

function teacherAppName(a: TeacherApplication): string {
  const parts = [a.first_name, a.last_name].filter(Boolean) as string[]
  if (parts.length > 0) return parts.join(" ")
  return a.email || a.contact || "Без имени"
}

function ticketPriorityClass(p: string): string {
  if (p === "high") return "priority-high"
  if (p === "medium") return "priority-med"
  return "priority-low"
}

type ServerTask = {
  id: string
  kind: string
  title: string
  meta: string[]
  urgent: boolean
  href: string | null
  ts: string | null
}

export default function AdminHomeClient({ fullName, initial }: Props) {
  const stats = initial.stats
  // Реальные задачи из /api/admin/tasks. Локальный «done» — оптимистичный
  // dismiss (хранится в localStorage), серверу мы их пока не пишем.
  const [serverTasks, setServerTasks] = useState<ServerTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const raw = window.localStorage.getItem("admin_done_tasks")
      const arr = raw ? (JSON.parse(raw) as string[]) : []
      return new Set(arr)
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/tasks", { cache: "no-store" })
        if (!res.ok) {
          setServerTasks([])
          return
        }
        const json = (await res.json()) as { tasks: ServerTask[] }
        if (cancelled) return
        setServerTasks(json.tasks ?? [])
      } catch {
        if (!cancelled) setServerTasks([])
      } finally {
        if (!cancelled) setTasksLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Привязываем к UI-форме, которой ждёт остальной jsx ниже.
  const tasks = useMemo(
    () => serverTasks.map((t) => ({ ...t, done: doneIds.has(t.id) })),
    [serverTasks, doneIds]
  )

  const subLine = useMemo(() => {
    try {
      const now = new Date()
      const day = format(now, "EEEE, d MMMM", { locale: ru })
      const parts = [day.charAt(0).toUpperCase() + day.slice(1)]
      if (stats.teacher_applications_new > 0)
        parts.push(`${stats.teacher_applications_new} заявок преподавателей`)
      if (stats.open_tickets > 0) parts.push(`${stats.open_tickets} обращений`)
      return parts.join(" · ")
    } catch {
      return "Админ-панель"
    }
  }, [stats])

  const maxBar = Math.max(...stats.signups_week, 1)
  // У бэка пока нет данных по предыдущему окну, поэтому показываем
  // абсолютный прирост за 7 дней без ↑/↓ к прошлой неделе — иначе
  // дельта противоречила бы графику (см. signups_week).
  const deltaWeekText =
    stats.students_delta_week > 0
      ? `+${stats.students_delta_week} за 7 дней`
      : "Без изменений"
  const deltaDayText =
    stats.apps_delta_day > 0
      ? `↑ +${stats.apps_delta_day} к вчера`
      : stats.apps_delta_day < 0
        ? `↓ ${stats.apps_delta_day} к вчера`
        : "как вчера"

  const toggleTask = (id: string) => {
    setDoneIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        window.localStorage.setItem("admin_done_tasks", JSON.stringify(Array.from(next)))
      } catch {
        // ignore — просто не сохранили
      }
      return next
    })
  }

  return (
    <div className="adm-home">

      <div className="dashboard-header">
        <div>
          <h1>Admin <span className="gl">panel</span></h1>
          <div className="sub">{subLine}</div>
        </div>
        <div className="user-menu">
          <Link href="/admin/settings" className="icon-btn" title="Настройки">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <Link
            href="/admin/support"
            className="icon-btn notifications"
            title="Поддержка"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {stats.open_tickets > 0 && (
              <span className="badge">{stats.open_tickets}</span>
            )}
          </Link>
          <div className="user-avatar">{initialsOf(fullName)}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Активных учеников</div>
          <div className="value">{stats.students_active.toLocaleString("ru-RU")}</div>
          <div
            className={`change ${stats.students_delta_week > 0 ? "positive" : ""}`}
          >
            {deltaWeekText}
          </div>
        </div>
        <div className="stat-card accent">
          <div className="label">Заявки преподавателей</div>
          <div className="value">{stats.teacher_applications_new}</div>
          <div
            className={`change ${stats.teacher_applications_new > 0 ? "positive" : ""}`}
          >
            {stats.teacher_applications_new > 0
              ? `${stats.teacher_applications_new} ждут разбора`
              : "Все разобраны"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Уроков сегодня</div>
          <div className="value">{stats.lessons_today}</div>
          <div className="change">
            {stats.live_now > 0
              ? `${stats.live_now} идут прямо сейчас`
              : "Сейчас уроков нет"}
          </div>
        </div>
        <div className="stat-card dark">
          <div className="label">Открытых обращений</div>
          <div className="value">
            {stats.open_tickets} <small>/ день</small>
          </div>
          <div className="change warning">
            {stats.tickets_urgent > 0
              ? `${stats.tickets_urgent} требуют реакции`
              : "Все под контролем"}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Заявки преподавателей</h3>
            <Link href="/admin/trial-requests" className="btn btn-sm btn-secondary">
              Все заявки
            </Link>
          </div>
          <div className="card-body">
            {initial.applications.length === 0 ? (
              <div className="empty">Новых заявок нет</div>
            ) : (
              <div className="apps-list">
                {initial.applications.slice(0, 5).map((a, i) => {
                  const st = appStatusLabel(a.status)
                  const hot = a.status === "new"
                  const name = teacherAppName(a)
                  return (
                    <div
                      key={a.id}
                      className={`app-item${hot ? " hot" : ""}`}
                    >
                      <div
                        className={`app-avatar ${avatarClassByIndex(i)}`}
                      >
                        {initialsOf(name)}
                      </div>
                      <div className="app-info">
                        <h4>{name}</h4>
                        <p>
                          {[a.email, a.contact].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                      </div>
                      <span className={`app-status ${st.cls}`}>{st.text}</span>
                      <div className="app-meta">{timeAgoRu(a.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h3>Быстрые действия</h3>
            </div>
            <div className="card-body">
              <div className="quick-actions">
                <Link href="/admin/trial-requests" className="primary">
                  <div className="ico">
                    <svg viewBox="0 0 24 24">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <path d="M5 7a4 4 0 0 1 8 0" />
                      <circle cx="18" cy="14" r="3" />
                    </svg>
                  </div>
                  Обработать заявку
                </Link>
                <Link href="/admin/teachers">
                  <div className="ico">
                    <svg viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  Добавить преподавателя
                </Link>
                <Link href="/admin/support">
                  <div className="ico">
                    <svg viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  Ответить в обращении
                </Link>
                <Link href="/admin/reports">
                  <div className="ico">
                    <svg viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  Создать отчёт
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Задачи на сегодня</h3>
            <span className="btn btn-sm btn-secondary">
              Всего ({tasks.length})
            </span>
          </div>
          <div className="card-body">
            <div className="task-list">
              {tasksLoading ? (
                <div className="empty">Загружаем задачи…</div>
              ) : tasks.length === 0 ? (
                <div className="empty">🎉 На сегодня всё чисто. Новых заявок, обращений и подвисших оплат нет.</div>
              ) : tasks.map((t) => (
                <div
                  key={t.id}
                  className={`task-item${t.urgent ? " urgent" : ""}${
                    t.done ? " done" : ""
                  }`}
                  role="group"
                >
                  <div
                    className="task-check"
                    onClick={() => toggleTask(t.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={t.done ? "Снять отметку выполнения" : "Отметить выполненной"}
                  ></div>
                  <div className="task-body">
                    {t.href ? (
                      <Link href={t.href} className="task-title" style={{ display: "block" }}>
                        {t.title}
                      </Link>
                    ) : (
                      <div className="task-title">{t.title}</div>
                    )}
                    <div className="task-meta">
                      {t.meta.map((m, i) => (
                        <span
                          key={i}
                          className={`tag${
                            i === 0 && t.urgent ? " urgent" : ""
                          }`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Обращения поддержки</h3>
            <Link href="/admin/support" className="btn btn-sm btn-secondary">
              Все ({stats.open_tickets})
            </Link>
          </div>
          <div className="card-body">
            {initial.tickets.length === 0 ? (
              <div className="empty">Нет открытых обращений</div>
            ) : (
              <div className="ticket-list">
                {initial.tickets.slice(0, 5).map((t, i) => (
                  <Link
                    href={`/admin/support?thread=${t.id}`}
                    key={t.id}
                    className={`ticket ${ticketPriorityClass(t.priority)}`}
                  >
                    <div className={`app-avatar ${avatarClassByIndex(i)}`}>
                      {initialsOf(t.student_name)}
                    </div>
                    <div className="ticket-body">
                      <div className="ticket-title">{t.subject || "(без темы)"}</div>
                      <div className="ticket-meta">
                        {t.student_name}
                        {t.student_level ? ` · ${t.student_level}` : ""}
                        {" · "}
                        {timeAgoRu(t.last_message_at || t.created_at)} назад
                      </div>
                    </div>
                    <div className="ticket-time">
                      {timeAgoRu(t.last_message_at || t.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Последние регистрации</h3>
            <Link href="/admin/students" className="btn btn-sm btn-secondary">
              Все ученики
            </Link>
          </div>
          <div className="card-body" style={{ padding: "0 0 8px" }}>
            {initial.students.length === 0 ? (
              <div className="empty">Нет новых регистраций</div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Уровень</th>
                    <th>Цель</th>
                    <th>Зарегистрирован</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {initial.students.slice(0, 5).map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <div className="user-cell">
                          <div
                            className={`user-mini-av ${avatarClassByIndex(i)}`}
                          >
                            {initialsOf(s.full_name)}
                          </div>
                          <div>
                            <strong>{s.full_name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`level-pill ${levelPillClass(s.level)}`}
                        >
                          {levelPillLabel(s.level)}
                        </span>
                      </td>
                      <td>{s.goal || "—"}</td>
                      <td>{timeAgoRu(s.created_at)}</td>
                      <td>
                        <Link
                          href={`/admin/students?id=${s.id}`}
                          className="btn btn-sm btn-primary"
                        >
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Регистрации за 7 дней</h3>
            <span className="btn btn-sm btn-secondary">
              {stats.signups_total} всего
            </span>
          </div>
          <div className="card-body">
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginBottom: 4,
              }}
            >
              {stats.signups_total > 0
                ? `В среднем ${Math.round(stats.signups_total / 7)}/день`
                : "Пока без регистраций"}
            </div>
            <div className="mini-chart">
              {stats.signups_week.map((v, i) => {
                const pct = Math.max(8, Math.round((v / maxBar) * 100))
                const isMax = v === maxBar && v > 0
                const cls = isMax ? "red" : i === 5 ? "lime" : ""
                return (
                  <div
                    key={i}
                    className={`mini-bar ${cls}`}
                    style={{ height: `${pct}%` }}
                    title={`${v} регистраций`}
                  ></div>
                )
              })}
            </div>
            <div className="chart-labels">
              <span>пн</span>
              <span>вт</span>
              <span>ср</span>
              <span>чт</span>
              <span>пт</span>
              <span>сб</span>
              <span>вс</span>
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                    fontWeight: 600,
                  }}
                >
                  Конверсия в пробный
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    marginTop: 4,
                    color: "var(--text)",
                  }}
                >
                  {stats.conversion_trial}
                  <small
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginLeft: 2,
                    }}
                  >
                    %
                  </small>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                    fontWeight: 600,
                  }}
                >
                  Пробный → оплата
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    marginTop: 4,
                    color: "var(--text)",
                  }}
                >
                  {stats.conversion_paid}
                  <small
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginLeft: 2,
                    }}
                  >
                    %
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
