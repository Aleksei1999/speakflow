// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

const CSS = `
.adm-home{max-width:1400px;margin:0 auto}

.adm-home .dashboard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
.adm-home .dashboard-header h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-home .dashboard-header .sub{font-size:14px;color:var(--muted);margin-top:4px}
.adm-home .user-menu{display:flex;align-items:center;gap:10px}
.adm-home .icon-btn{width:40px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;color:var(--text)}
.adm-home .icon-btn:hover{border-color:var(--text)}
.adm-home .icon-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.adm-home .icon-btn.notifications{position:relative}
.adm-home .icon-btn .badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;background:var(--red);color:#fff;border-radius:999px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid var(--surface)}
.adm-home .user-avatar{width:40px;height:40px;background:var(--accent-dark);color:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
[data-theme="dark"] .adm-home .user-avatar{background:var(--red)}

.adm-home .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.adm-home .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s ease}
.adm-home .stat-card:hover{border-color:var(--text)}
.adm-home .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.adm-home .stat-card .value{font-size:32px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1;color:var(--text)}
.adm-home .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.adm-home .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.adm-home .stat-card .change.positive{color:#22c55e;font-weight:600}
.adm-home .stat-card .change.warning{color:#F59E0B;font-weight:600}
.adm-home .stat-card.accent{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.adm-home .stat-card.accent .label{color:#0A0A0A;opacity:.7}
.adm-home .stat-card.accent .value{color:#0A0A0A}
.adm-home .stat-card.accent .value small{color:rgba(10,10,10,.6)}
.adm-home .stat-card.accent .change.positive{color:#0A0A0A}
.adm-home .stat-card.dark{background:#0A0A0A;color:#fff;border-color:#0A0A0A}
.adm-home .stat-card.dark .label{color:#A0A09A}
.adm-home .stat-card.dark .value{color:#fff}
.adm-home .stat-card.dark .value small{color:#A0A09A}
[data-theme="dark"] .adm-home .stat-card.dark{background:var(--red);border-color:var(--red)}
[data-theme="dark"] .adm-home .stat-card.dark .label{color:rgba(255,255,255,.7)}

.adm-home .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:background .2s ease,border-color .2s ease}
.adm-home .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)}
.adm-home .card-header h3{font-size:18px;font-weight:800;letter-spacing:-.3px;color:var(--text)}
.adm-home .card-body{padding:8px 22px 20px}

.adm-home .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.adm-home .btn:active{transform:scale(.97)}
.adm-home .btn-sm{padding:6px 14px;font-size:12px}
.adm-home .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-home .btn-secondary:hover{border-color:var(--text)}
.adm-home .btn-primary{background:var(--accent-dark);color:#fff}
.adm-home .btn-primary:hover{background:var(--red)}
.adm-home .btn-red{background:var(--red);color:#fff}
.adm-home .btn-red:hover{filter:brightness(.9)}

.adm-home .dashboard-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;margin-bottom:22px}
.adm-home .dashboard-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px}

.adm-home .apps-list{display:flex;flex-direction:column}
.adm-home .app-item{display:flex;align-items:center;gap:14px;padding:12px 10px;border-bottom:1px solid var(--border);border-radius:12px;transition:background .15s ease}
.adm-home .app-item:last-child{border-bottom:none}
.adm-home .app-item:hover{background:var(--surface-2)}
.adm-home .app-item.hot{background:rgba(230,57,70,.04)}
[data-theme="dark"] .adm-home .app-item.hot{background:rgba(230,57,70,.08)}
.adm-home .app-avatar{width:40px;height:40px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;color:var(--text)}
.adm-home .app-avatar.red{background:var(--red);color:#fff}
.adm-home .app-avatar.lime{background:var(--lime);color:#0A0A0A}
.adm-home .app-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-home .app-avatar.dark{background:var(--red)}
.adm-home .app-info{flex:1;min-width:0}
.adm-home .app-info h4{font-size:14px;font-weight:700;margin-bottom:2px;color:var(--text)}
.adm-home .app-info p{font-size:12px;color:var(--muted)}
.adm-home .app-status{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.adm-home .app-status-new{background:var(--red);color:#fff}
.adm-home .app-status-pending{background:var(--bg);color:var(--muted)}
.adm-home .app-status-done{background:rgba(34,197,94,.1);color:#22c55e}
[data-theme="dark"] .adm-home .app-status-done{background:rgba(34,197,94,.15)}
.adm-home .app-meta{font-size:11px;color:var(--muted);white-space:nowrap}

.adm-home .task-list{display:flex;flex-direction:column;gap:10px}
.adm-home .task-item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;transition:all .15s ease;cursor:pointer}
.adm-home .task-item:hover{border-color:var(--text)}
.adm-home .task-item.urgent{border-color:var(--red);background:rgba(230,57,70,.03)}
[data-theme="dark"] .adm-home .task-item.urgent{background:rgba(230,57,70,.06)}
.adm-home .task-check{width:18px;height:18px;border:2px solid var(--border);border-radius:6px;flex-shrink:0;margin-top:1px;position:relative}
.adm-home .task-item.done .task-check{background:var(--accent-dark);border-color:var(--accent-dark)}
[data-theme="dark"] .adm-home .task-item.done .task-check{background:var(--red);border-color:var(--red)}
.adm-home .task-item.done .task-check::after{content:'';position:absolute;left:4px;top:1px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.adm-home .task-item.done .task-title{text-decoration:line-through;color:var(--muted)}
.adm-home .task-body{flex:1;min-width:0}
.adm-home .task-title{font-size:13px;font-weight:700;line-height:1.3;color:var(--text)}
.adm-home .task-meta{font-size:11px;color:var(--muted);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap}
.adm-home .task-meta .tag{background:var(--bg);padding:2px 8px;border-radius:6px;font-weight:600}
.adm-home .task-meta .tag.urgent{background:var(--red);color:#fff}

.adm-home .users-table{width:100%;border-collapse:collapse}
.adm-home .users-table th{text-align:left;padding:10px 14px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border)}
.adm-home .users-table td{padding:12px 14px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle;color:var(--text)}
.adm-home .users-table tr:last-child td{border-bottom:none}
.adm-home .users-table tr:hover td{background:var(--surface-2)}
.adm-home .user-cell{display:flex;align-items:center;gap:10px}
.adm-home .user-mini-av{width:32px;height:32px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;color:var(--text)}
.adm-home .user-mini-av.red{background:var(--red);color:#fff}
.adm-home .user-mini-av.lime{background:var(--lime);color:#0A0A0A}
.adm-home .user-mini-av.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-home .user-mini-av.dark{background:var(--red)}
.adm-home .level-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);color:var(--text)}
.adm-home .level-pill.rare{background:rgba(230,57,70,.1);color:var(--red)}
.adm-home .level-pill.mrare{background:rgba(216,242,106,.25);color:#5A7A00}
[data-theme="dark"] .adm-home .level-pill.mrare{background:rgba(216,242,106,.15);color:var(--lime)}
.adm-home .level-pill.medium{background:rgba(245,185,66,.15);color:#B8860B}
.adm-home .level-pill.welldone{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-home .level-pill.welldone{background:var(--red)}

.adm-home .mini-chart{display:flex;align-items:flex-end;gap:4px;height:120px;padding:10px 0}
.adm-home .mini-bar{flex:1;background:var(--bg);border-radius:4px 4px 0 0;position:relative;min-height:8px;transition:background .15s}
.adm-home .mini-bar.lime{background:var(--lime)}
.adm-home .mini-bar.red{background:var(--red)}
.adm-home .mini-bar.dark{background:var(--accent-dark)}
.adm-home .mini-bar:hover{opacity:.85}
.adm-home .chart-labels{display:flex;gap:4px;margin-top:6px}
.adm-home .chart-labels span{flex:1;font-size:9px;color:var(--muted);text-align:center;font-weight:600}

.adm-home .ticket-list{display:flex;flex-direction:column;gap:8px}
.adm-home .ticket{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--border);border-radius:10px;transition:all .15s ease;cursor:pointer;text-decoration:none;color:inherit}
.adm-home .ticket:hover{border-color:var(--text)}
.adm-home .ticket.priority-high{border-left:3px solid var(--red)}
.adm-home .ticket.priority-med{border-left:3px solid #F59E0B}
.adm-home .ticket.priority-low{border-left:3px solid #22c55e}
.adm-home .ticket-body{flex:1;min-width:0}
.adm-home .ticket-title{font-size:13px;font-weight:700;line-height:1.3;margin-bottom:2px;color:var(--text)}
.adm-home .ticket-meta{font-size:11px;color:var(--muted)}
.adm-home .ticket-time{font-size:11px;color:var(--muted);white-space:nowrap}

.adm-home .quick-actions{display:flex;flex-direction:column;gap:8px}
.adm-home .quick-actions a{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid var(--border);font-size:13px;font-weight:600;transition:all .15s ease;text-decoration:none;color:var(--text)}
.adm-home .quick-actions a:hover{border-color:var(--text)}
.adm-home .quick-actions a.primary{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
.adm-home .quick-actions a.primary:hover{background:var(--red);border-color:var(--red)}
.adm-home .quick-actions .ico{width:30px;height:30px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.adm-home .quick-actions a.primary .ico{background:var(--red)}
.adm-home .quick-actions .ico svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.adm-home .quick-actions a.primary .ico svg{stroke:#fff}

.adm-home .empty{padding:30px 12px;text-align:center;color:var(--muted);font-size:13px}

@media (max-width:1100px){
  .adm-home .stats-grid{grid-template-columns:repeat(2,1fr)}
  .adm-home .dashboard-grid,.adm-home .dashboard-grid-2{grid-template-columns:1fr}
}
@media (max-width:640px){
  .adm-home .dashboard-header h1{font-size:26px}
  .adm-home .stats-grid{grid-template-columns:1fr 1fr}
  .adm-home .users-table th:nth-child(4),.adm-home .users-table td:nth-child(4){display:none}
}
`

type AdminStats = {
  students_active: number
  students_delta_week: number
  apps_today: number
  apps_delta_day: number
  lessons_today: number
  live_now: number
  open_tickets: number
  tickets_urgent: number
  signups_week: number[]
  signups_total: number
  conversion_trial: number
  conversion_paid: number
}

type TrialRequest = {
  id: string
  student_name: string
  level: string | null
  goal: string | null
  preferred_slot: string | null
  status: "new" | "processing" | "matched" | "done" | "cancelled"
  created_at: string
  notes: string | null
  assigned_teacher_id: string | null
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
    requests: TrialRequest[]
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
    case "processing":
      return { cls: "app-status-pending", text: "обрабатывается" }
    case "matched":
      return { cls: "app-status-done", text: "✓ подобрали" }
    case "done":
      return { cls: "app-status-done", text: "✓ готово" }
    case "cancelled":
      return { cls: "app-status-pending", text: "отмена" }
    default:
      return { cls: "app-status-pending", text: s || "—" }
  }
}

function ticketPriorityClass(p: string): string {
  if (p === "high") return "priority-high"
  if (p === "medium") return "priority-med"
  return "priority-low"
}

export default function AdminHomeClient({ fullName, initial }: Props) {
  const stats = initial.stats
  const [tasks, setTasks] = useState([
    {
      id: "t1",
      title: "Подобрать преподавателя B2 на понедельник 19:00",
      meta: ["срочно", "Роман Смирнов", "до 18:00"],
      urgent: true,
      done: false,
    },
    {
      id: "t2",
      title: "Связаться с Анной Беловой — пропала после пробного",
      meta: ["лид", "B1 · для работы"],
      urgent: false,
      done: false,
    },
    {
      id: "t3",
      title: "Подтвердить переводы преподавателям за март",
      meta: ["финансы", "47 преподавателей"],
      urgent: false,
      done: false,
    },
    {
      id: "t4",
      title: "Проверить модерацию speaking club «Pitch night»",
      meta: ["контент"],
      urgent: false,
      done: true,
    },
    {
      id: "t5",
      title: "Обновить прайс на пакет из 20 уроков",
      meta: ["маркетинг"],
      urgent: false,
      done: false,
    },
  ])

  const subLine = useMemo(() => {
    try {
      const now = new Date()
      const day = format(now, "EEEE, d MMMM", { locale: ru })
      const parts = [day.charAt(0).toUpperCase() + day.slice(1)]
      if (stats.apps_today > 0) parts.push(`${stats.apps_today} новых заявок`)
      if (stats.open_tickets > 0) parts.push(`${stats.open_tickets} тикетов`)
      return parts.join(" · ")
    } catch {
      return "Админ-панель"
    }
  }, [stats])

  const maxBar = Math.max(...stats.signups_week, 1)
  const deltaWeekText =
    stats.students_delta_week > 0
      ? `↑ +${stats.students_delta_week} за неделю`
      : stats.students_delta_week < 0
        ? `↓ ${stats.students_delta_week} за неделю`
        : "Без изменений"
  const deltaDayText =
    stats.apps_delta_day > 0
      ? `↑ +${stats.apps_delta_day} к вчера`
      : stats.apps_delta_day < 0
        ? `↓ ${stats.apps_delta_day} к вчера`
        : "как вчера"

  const toggleTask = (id: string) => {
    setTasks((cur) =>
      cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    )
  }

  return (
    <div className="adm-home">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="dashboard-header">
        <div>
          <h1>Админ-панель</h1>
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
          <div className="label">Заявок сегодня</div>
          <div className="value">{stats.apps_today}</div>
          <div
            className={`change ${stats.apps_delta_day > 0 ? "positive" : ""}`}
          >
            {deltaDayText}
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
          <div className="label">Открытых тикетов</div>
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
            <h3>Новые заявки на пробный</h3>
            <Link href="/admin/trial-requests" className="btn btn-sm btn-secondary">
              Все заявки
            </Link>
          </div>
          <div className="card-body">
            {initial.requests.length === 0 ? (
              <div className="empty">Пока нет заявок</div>
            ) : (
              <div className="apps-list">
                {initial.requests.slice(0, 5).map((r, i) => {
                  const st = appStatusLabel(r.status)
                  const hot = r.status === "new"
                  return (
                    <div
                      key={r.id}
                      className={`app-item${hot ? " hot" : ""}`}
                    >
                      <div
                        className={`app-avatar ${avatarClassByIndex(i)}`}
                      >
                        {initialsOf(r.student_name)}
                      </div>
                      <div className="app-info">
                        <h4>{r.student_name}</h4>
                        <p>
                          {[r.level, r.goal, r.preferred_slot]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                      <span className={`app-status ${st.cls}`}>{st.text}</span>
                      <div className="app-meta">{timeAgoRu(r.created_at)}</div>
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
                  Ответить в тикете
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
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`task-item${t.urgent ? " urgent" : ""}${
                    t.done ? " done" : ""
                  }`}
                  onClick={() => toggleTask(t.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="task-check"></div>
                  <div className="task-body">
                    <div className="task-title">{t.title}</div>
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
            <h3>Тикеты поддержки</h3>
            <Link href="/admin/support" className="btn btn-sm btn-secondary">
              Все ({stats.open_tickets})
            </Link>
          </div>
          <div className="card-body">
            {initial.tickets.length === 0 ? (
              <div className="empty">Нет открытых тикетов</div>
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
