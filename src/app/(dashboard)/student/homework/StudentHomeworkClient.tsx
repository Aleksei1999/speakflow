// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format, differenceInCalendarDays } from "date-fns"
import { ru } from "date-fns/locale"

const CSS = `
.stu-hw{max-width:1200px;margin:0 auto}
.stu-hw .sh-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.stu-hw .sh-hdr h1{font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.1}
.stu-hw .sh-hdr h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-hw .sh-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.stu-hw .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:100px;font-size:12px;font-weight:700;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.stu-hw .btn:active{transform:scale(.97)}
.stu-hw .btn:disabled{opacity:.55;cursor:not-allowed}
.stu-hw .btn-sm{padding:6px 12px;font-size:11px}
.stu-hw .btn-red{background:var(--red);color:#fff}
.stu-hw .btn-red:hover{filter:brightness(.9)}
.stu-hw .btn-lime{background:var(--lime);color:#0A0A0A}
.stu-hw .btn-lime:hover{filter:brightness(.95)}
.stu-hw .btn-dark{background:var(--accent-dark);color:#fff}
.stu-hw .btn-dark:hover{background:var(--red)}
[data-theme="dark"] .stu-hw .btn-dark{background:var(--surface-2)}
.stu-hw .btn-ghost-dark{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.1)}
.stu-hw .btn-ghost-dark:hover{background:rgba(255,255,255,.14)}
.stu-hw .btn-outline{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.stu-hw .btn-outline:hover{border-color:var(--text)}

/* URGENT HERO */
.stu-hw .urgent-hero{background:linear-gradient(100deg,#0A0A0A 0%,#1a1a18 60%,#242422 100%);border-radius:20px;padding:20px 24px;margin-bottom:20px;color:#fff;display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;position:relative;overflow:hidden}
[data-theme="dark"] .stu-hw .urgent-hero{background:linear-gradient(100deg,#1a1a18 0%,#222220 100%)}
.stu-hw .urgent-hero::before{content:'';position:absolute;top:0;bottom:0;left:0;width:4px;background:linear-gradient(180deg,var(--amber,#F59E0B),var(--red))}
.stu-hw .urgent-hero::after{content:'';position:absolute;top:-50%;right:-10%;width:380px;height:380px;background:radial-gradient(circle,rgba(230,57,70,.1),transparent 60%);pointer-events:none}
.stu-hw .uh-bignum{font-family:'Gluten',cursive;font-size:64px;font-weight:600;color:var(--red);line-height:.9;letter-spacing:-2px;position:relative;z-index:1;align-self:center;padding-right:4px}
.stu-hw .uh-who{display:flex;align-items:flex-start;gap:12px;position:relative;z-index:1;min-width:0}
.stu-hw .uh-avatar{width:42px;height:42px;border-radius:50%;background:var(--red);border:2px solid var(--lime);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;margin-top:2px;overflow:hidden}
.stu-hw .uh-avatar img{width:100%;height:100%;object-fit:cover}
.stu-hw .uh-info{min-width:0;flex:1}
.stu-hw .uh-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.stu-hw .uh-label .pulse{width:6px;height:6px;background:var(--red);border-radius:50%;animation:uhPulse 1.6s infinite}
@keyframes uhPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
.stu-hw .uh-title{font-size:15px;font-weight:800;letter-spacing:-.2px;line-height:1.3;color:#fff;margin-bottom:6px}
.stu-hw .uh-title .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-hw .uh-sub{font-size:12px;color:rgba(255,255,255,.55);line-height:1.45}
.stu-hw .uh-actions{position:relative;z-index:1;display:flex;gap:8px;align-items:center;flex-shrink:0}

/* STATS */
.stu-hw .hw-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
.stu-hw .h-stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;transition:border-color .15s}
.stu-hw .h-stat:hover{border-color:var(--text)}
.stu-hw .h-stat-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.stu-hw .h-stat-ico.red{background:rgba(230,57,70,.08);color:var(--red)}
.stu-hw .h-stat-ico.amber{background:rgba(245,158,11,.12);color:#F59E0B}
.stu-hw .h-stat-ico.lime{background:rgba(216,242,106,.2);color:#5A7A00}
[data-theme="dark"] .stu-hw .h-stat-ico.lime{background:rgba(216,242,106,.15);color:var(--lime)}
.stu-hw .h-stat-ico.dark{background:var(--bg);color:var(--text)}
.stu-hw .h-stat-ico svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-hw .h-stat-val{font-size:20px;font-weight:800;letter-spacing:-.5px;line-height:1;font-variant-numeric:tabular-nums}
.stu-hw .h-stat-val .gl{font-family:'Gluten',cursive;font-weight:600}
.stu-hw .h-stat-lbl{font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}

/* FILTERS */
.stu-hw .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:100px;padding:4px;margin-bottom:20px;width:fit-content;max-width:100%;overflow-x:auto}
.stu-hw .filter-tabs button{padding:8px 16px;border-radius:100px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:none;background:none;cursor:pointer;font-family:inherit}
.stu-hw .filter-tabs button:hover{color:var(--text)}
.stu-hw .filter-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .stu-hw .filter-tabs button.active{background:var(--red)}
.stu-hw .filter-tabs .count-dot{background:rgba(0,0,0,.08);color:inherit;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .stu-hw .filter-tabs .count-dot{background:rgba(255,255,255,.08)}
.stu-hw .filter-tabs button.active .count-dot{background:rgba(255,255,255,.22)}
.stu-hw .filter-tabs .pulse-dot{width:6px;height:6px;background:var(--red);border-radius:50%}

/* SECTION */
.stu-hw .section{margin-bottom:28px}
.stu-hw .section-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;gap:14px}
.stu-hw .section-title{font-size:16px;font-weight:800;letter-spacing:-.3px}
.stu-hw .section-title .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-hw .section-sub{font-size:12px;color:var(--muted);font-weight:600;margin-top:4px}

/* HW CARD */
.stu-hw .hw-list{display:flex;flex-direction:column;gap:12px}
.stu-hw .hw-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;transition:all .15s;position:relative;overflow:hidden}
.stu-hw .hw-card:hover{border-color:var(--text);transform:translateY(-1px);box-shadow:0 6px 16px rgba(10,10,10,.04)}
.stu-hw .hw-card.overdue{border-color:var(--red);background:rgba(230,57,70,.03)}
.stu-hw .hw-card.overdue::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--red)}
.stu-hw .hw-card.soon::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:#F59E0B}
.stu-hw .hw-card.submitted::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent-dark)}
[data-theme="dark"] .stu-hw .hw-card.submitted::before{background:#666}
.stu-hw .hw-card.graded::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--lime)}

.stu-hw .hw-date{width:60px;height:60px;border-radius:14px;background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.stu-hw .hw-date.overdue{background:rgba(230,57,70,.1);color:var(--red)}
.stu-hw .hw-date.soon{background:rgba(245,158,11,.12);color:#F59E0B}
.stu-hw .hw-date.done{background:rgba(216,242,106,.2);color:#5A7A00}
[data-theme="dark"] .stu-hw .hw-date.done{background:rgba(216,242,106,.15);color:var(--lime)}
.stu-hw .hw-date-day{font-size:20px;letter-spacing:-.5px;line-height:1;font-family:'Gluten',cursive;font-weight:600}
.stu-hw .hw-date-mon{font-size:10px;font-weight:700;text-transform:uppercase;margin-top:2px;opacity:.75}
.stu-hw .hw-date-status{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}

.stu-hw .hw-body{min-width:0}
.stu-hw .hw-status-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap}
.stu-hw .hw-status{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:100px;font-size:10px;font-weight:800;letter-spacing:.3px;text-transform:uppercase}
.stu-hw .hw-status.todo{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .stu-hw .hw-status.todo{background:var(--red)}
.stu-hw .hw-status.soon{background:rgba(245,158,11,.12);color:#F59E0B}
.stu-hw .hw-status.overdue{background:var(--red);color:#fff}
.stu-hw .hw-status.submitted{background:var(--bg);color:var(--muted);border:1px solid var(--border)}
.stu-hw .hw-status.graded{background:var(--lime);color:#0A0A0A}

.stu-hw .hw-lesson-tag{font-size:11px;color:var(--muted);font-weight:600}
.stu-hw .hw-lesson-tag b{color:var(--text);font-weight:700}

.stu-hw .hw-title{font-size:15px;font-weight:800;letter-spacing:-.2px;line-height:1.3;margin-bottom:4px;color:var(--text)}
.stu-hw .hw-desc{font-size:12px;color:var(--muted);line-height:1.45;margin-bottom:8px;white-space:pre-wrap}

.stu-hw .hw-meta{display:flex;align-items:center;gap:12px;font-size:11px;color:var(--muted);flex-wrap:wrap}
.stu-hw .hw-meta svg{width:12px;height:12px;vertical-align:-2px;margin-right:3px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-hw .hw-meta .m-item{display:inline-flex;align-items:center;gap:4px}
.stu-hw .hw-meta .m-item b{color:var(--text);font-weight:700}
.stu-hw .hw-meta .xp{font-family:'Gluten',cursive;color:#5A7A00;font-weight:600;font-size:12px}
[data-theme="dark"] .stu-hw .hw-meta .xp{color:var(--lime)}

.stu-hw .hw-grade{display:flex;flex-direction:column;align-items:center;padding:8px 14px;border-radius:14px;background:var(--lime);color:#0A0A0A;flex-shrink:0;min-width:66px}
.stu-hw .hw-grade.mid{background:#E8F2A8}
.stu-hw .hw-grade.low{background:rgba(230,57,70,.15);color:var(--red)}
.stu-hw .hw-grade-num{font-family:'Gluten',cursive;font-size:24px;font-weight:600;line-height:1}
.stu-hw .hw-grade-lbl{font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-top:2px}

.stu-hw .hw-cta{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0}
.stu-hw .hw-cta-hint{font-size:10px;color:var(--muted);text-align:right;margin-top:2px}

.stu-hw .hw-feedback{margin-top:10px;padding:10px 12px;background:var(--surface-2);border-radius:10px;font-size:12px;color:var(--text);line-height:1.5;border-left:3px solid var(--lime)}
.stu-hw .hw-feedback::before{content:'💬 '}
.stu-hw .hw-feedback b{color:#5A7A00;font-weight:700}
[data-theme="dark"] .stu-hw .hw-feedback b{color:var(--lime)}

.stu-hw .empty-state{padding:40px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.stu-hw .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

/* MODAL */
.stu-hw .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:shwFade .15s ease}
@keyframes shwFade{from{opacity:0}to{opacity:1}}
.stu-hw .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:560px;max-height:90vh;overflow:auto;padding:24px;color:var(--text)}
.stu-hw .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.stu-hw .modal-card .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.stu-hw .field{margin-bottom:14px}
.stu-hw .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.stu-hw .field input,.stu-hw .field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;transition:border-color .15s}
.stu-hw .field input:focus,.stu-hw .field textarea:focus{outline:none;border-color:var(--text)}
.stu-hw .field textarea{resize:vertical;min-height:140px}
.stu-hw .hint{font-size:11px;color:var(--muted);margin-top:4px}
.stu-hw .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
.stu-hw .modal-actions .left{margin-right:auto}
.stu-hw .attach-row{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:12px;margin-bottom:6px}
.stu-hw .attach-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.stu-hw .attach-row .rm{width:22px;height:22px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;font-size:14px;line-height:1}
.stu-hw .attach-row .rm:hover{color:var(--red);border-color:var(--red)}

/* Responsive */
@media(max-width:1024px){.stu-hw .hw-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){
  .stu-hw .urgent-hero{grid-template-columns:auto 1fr;gap:14px}
  .stu-hw .urgent-hero .uh-actions{grid-column:1 / -1;justify-content:flex-start;flex-wrap:wrap;margin-top:4px}
  .stu-hw .uh-bignum{font-size:48px}
  .stu-hw .hw-card{grid-template-columns:auto 1fr;gap:12px}
  .stu-hw .hw-cta,.stu-hw .hw-grade{grid-column:1 / -1;flex-direction:row;justify-content:flex-end;align-items:center;margin-top:4px}
  .stu-hw .hw-grade{justify-content:center}
}
@media(max-width:600px){
  .stu-hw .hw-stats{grid-template-columns:1fr 1fr}
  .stu-hw .hw-meta{flex-direction:column;align-items:flex-start;gap:4px}
}
`

type Attachment = {
  name: string
  url: string
  size?: number
  mime?: string
}

type HwItem = {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_avatar: string | null
  lesson_id: string | null
  lesson_at: string | null
  title: string
  description: string | null
  due_date: string
  status: "pending" | "in_progress" | "submitted" | "reviewed" | "overdue"
  ui_status: "todo" | "soon" | "overdue" | "submitted" | "reviewed"
  submission_text: string | null
  teacher_feedback: string | null
  grade: number | null
  score_10: number | null
  submitted_at: string | null
  reviewed_at: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
}

type Snapshot = {
  homework: HwItem[]
  counts: { all: number; todo: number; submitted: number; reviewed: number }
  stats: {
    xp_this_month: number
    reviewed_lifetime: number
    waiting: number
    in_review: number
  }
  urgent: any | null
}

type FilterKey = "all" | "todo" | "submitted" | "reviewed"

const MONTH_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
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

function humanDueLabel(due: string, ui: string): string {
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return ""
  if (ui === "submitted") return "сдано"
  if (ui === "reviewed") {
    const days = Math.abs(differenceInCalendarDays(new Date(), d))
    if (days === 0) return "сегодня"
    if (days === 1) return "1 день"
    if (days < 5) return `${days} дня`
    return `${days} дней`
  }
  const days = differenceInCalendarDays(d, new Date())
  if (days < 0) {
    const n = Math.abs(days)
    if (n === 1) return "вчера"
    return `-${n} ${n < 5 ? "дня" : "дней"}`
  }
  if (days === 0) return "сегодня"
  if (days === 1) return "завтра"
  if (days < 5) return `${days} дня`
  return `${days} дней`
}

function dateSquareClass(ui: string): string {
  if (ui === "overdue") return "overdue"
  if (ui === "soon") return "soon"
  if (ui === "reviewed") return "done"
  return ""
}

function statusPillLabel(ui: string): { cls: string; text: string } {
  switch (ui) {
    case "overdue":
      return { cls: "overdue", text: "просрочено" }
    case "soon":
      return { cls: "soon", text: "⏱ срок скоро" }
    case "submitted":
      return { cls: "submitted", text: "⏳ проверяется" }
    case "reviewed":
      return { cls: "graded", text: "✓ проверено" }
    case "todo":
    default:
      return { cls: "todo", text: "в работе" }
  }
}

function gradeColorClass(score: number | null): string {
  if (score === null) return ""
  if (score >= 8) return ""
  if (score >= 5) return "mid"
  return "low"
}

function formatDateInputLocal(iso: string | null): string {
  if (!iso) return ""
  try {
    return format(new Date(iso), "d MMMM, HH:mm", { locale: ru })
  } catch {
    return ""
  }
}

export default function StudentHomeworkClient({ initial }: { initial: Snapshot }) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [items, setItems] = useState<HwItem[]>(initial.homework)
  const [counts, setCounts] = useState(initial.counts)
  const [stats, setStats] = useState(initial.stats)
  const [urgent, setUrgent] = useState<any | null>(initial.urgent)
  const [busy, setBusy] = useState(false)
  const [submitFor, setSubmitFor] = useState<HwItem | null>(null)
  const [viewOnly, setViewOnly] = useState<HwItem | null>(null)

  // Refresh from API after mutations
  async function reload(nextFilter: FilterKey = filter) {
    try {
      const res = await fetch(
        `/api/student/homework?filter=${nextFilter}&sort=due_soon`,
        { cache: "no-store" }
      )
      if (!res.ok) return
      const j = await res.json()
      setItems(Array.isArray(j.homework) ? j.homework : [])
      setCounts({ ...initial.counts, ...(j.counts ?? {}) })
      setStats({ ...initial.stats, ...(j.stats ?? {}) })
      setUrgent(j.urgent ?? null)
    } catch {
      /* noop */
    }
  }

  function changeFilter(next: FilterKey) {
    if (next === filter) return
    setFilter(next)
    reload(next)
  }

  // Split into sections
  const { todoList, submittedList, reviewedList } = useMemo(() => {
    const todoList: HwItem[] = []
    const submittedList: HwItem[] = []
    const reviewedList: HwItem[] = []
    for (const it of items) {
      if (it.ui_status === "submitted") submittedList.push(it)
      else if (it.ui_status === "reviewed") reviewedList.push(it)
      else todoList.push(it)
    }
    return { todoList, submittedList, reviewedList }
  }, [items])

  const showTodo = filter === "all" || filter === "todo"
  const showSubmitted = filter === "all" || filter === "submitted"
  const showReviewed = filter === "all" || filter === "reviewed"

  const totalVisible =
    (showTodo ? todoList.length : 0) +
    (showSubmitted ? submittedList.length : 0) +
    (showReviewed ? reviewedList.length : 0)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="stu-hw">
        <div className="sh-hdr">
          <div>
            <h1>
              Моя <span className="gl">homework</span>
            </h1>
            <div className="sub">
              {counts.todo > 0 ? `${counts.todo} ждут тебя` : "свободно"}
              {counts.submitted > 0 ? ` · ${counts.submitted} проверяется` : ""}
              {counts.reviewed > 0 ? ` · ${counts.reviewed} разобрано` : ""}
            </div>
          </div>
        </div>

        {/* URGENT HERO */}
        {urgent && counts.todo > 0 ? (
          <div className="urgent-hero">
            <div className="uh-bignum">{counts.todo}</div>
            <div className="uh-who">
              <div className="uh-avatar">
                {urgent.teacher_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urgent.teacher_avatar} alt="" />
                ) : (
                  initialsOf(urgent.teacher_name)
                )}
              </div>
              <div className="uh-info">
                <div className="uh-label">
                  <span className="pulse"></span>
                  {urgent.ui_status === "overdue"
                    ? "просрочено — надо срочно"
                    : `ближайший дедлайн · ${humanDueLabel(urgent.due_date, urgent.ui_status)}`}
                </div>
                <div className="uh-title">{urgent.title}</div>
                <div className="uh-sub">
                  {urgent.description
                    ? String(urgent.description).slice(0, 160) +
                      (String(urgent.description).length > 160 ? "…" : "")
                    : `Сдать до ${formatDateInputLocal(urgent.due_date)}`}
                </div>
              </div>
            </div>
            <div className="uh-actions">
              <button
                type="button"
                className="btn btn-lime"
                onClick={() => {
                  const target = items.find((x) => x.id === urgent.id)
                  if (target) setSubmitFor(target)
                }}
              >
                Сдать работу
              </button>
            </div>
          </div>
        ) : null}

        {/* STATS */}
        <div className="hw-stats">
          <div className="h-stat">
            <div className="h-stat-ico red">
              <svg viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">{stats.waiting}</div>
              <div className="h-stat-lbl">Ждут тебя</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico amber">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val" style={{ color: "#F59E0B" }}>
                {stats.in_review}
              </div>
              <div className="h-stat-lbl">На проверке</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico lime">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">{stats.reviewed_lifetime}</div>
              <div className="h-stat-lbl">Проверено</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico dark">
              <svg viewBox="0 0 24 24">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">
                <span className="gl">+{stats.xp_this_month}</span> XP
              </div>
              <div className="h-stat-lbl">За этот месяц</div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => changeFilter("all")}
          >
            Все <span className="count-dot">{counts.all}</span>
          </button>
          <button
            className={filter === "todo" ? "active" : ""}
            onClick={() => changeFilter("todo")}
          >
            {counts.todo > 0 ? <span className="pulse-dot"></span> : null}
            Надо сделать <span className="count-dot">{counts.todo}</span>
          </button>
          <button
            className={filter === "submitted" ? "active" : ""}
            onClick={() => changeFilter("submitted")}
          >
            На проверке <span className="count-dot">{counts.submitted}</span>
          </button>
          <button
            className={filter === "reviewed" ? "active" : ""}
            onClick={() => changeFilter("reviewed")}
          >
            Проверенные <span className="count-dot">{counts.reviewed}</span>
          </button>
        </div>

        {/* Empty state */}
        {totalVisible === 0 ? (
          <div className="empty-state">
            <b>Здесь пусто</b>
            Когда преподаватель выдаст задание — оно появится тут.
          </div>
        ) : null}

        {/* TODO */}
        {showTodo && todoList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  Надо <span className="gl">to do</span>
                </div>
                <div className="section-sub">
                  Сделай эти задания — преподаватель ждёт
                </div>
              </div>
            </div>
            <div className="hw-list">
              {todoList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* SUBMITTED */}
        {showSubmitted && submittedList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  На <span className="gl">review</span>
                </div>
                <div className="section-sub">
                  Ты сдал — ждём фидбэк. Обычно это 1–2 дня
                </div>
              </div>
            </div>
            <div className="hw-list">
              {submittedList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* REVIEWED */}
        {showReviewed && reviewedList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  <span className="gl">Reviewed</span> — с фидбэком
                </div>
                <div className="section-sub">
                  Преподаватель разобрал твои работы — посмотри комментарии
                </div>
              </div>
            </div>
            <div className="hw-list">
              {reviewedList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {submitFor ? (
        <SubmitModal
          item={submitFor}
          busy={busy}
          onClose={() => setSubmitFor(null)}
          onSubmitted={async () => {
            setSubmitFor(null)
            await reload()
            toast.success("Работа отправлена преподавателю")
          }}
          setBusy={setBusy}
        />
      ) : null}

      {viewOnly ? (
        <ViewModal item={viewOnly} onClose={() => setViewOnly(null)} />
      ) : null}
    </>
  )
}

function HwCard({
  item,
  onSubmit,
  onOpen,
}: {
  item: HwItem
  onSubmit: () => void
  onOpen: () => void
}) {
  const due = new Date(item.due_date)
  const day = isNaN(due.getTime()) ? "–" : String(due.getDate()).padStart(2, "0")
  const mon = isNaN(due.getTime()) ? "" : MONTH_SHORT[due.getMonth()]
  const dateStatus = humanDueLabel(item.due_date, item.ui_status)

  const pill = statusPillLabel(item.ui_status)
  const cardClass = ["hw-card"]
  if (item.ui_status === "overdue") cardClass.push("overdue")
  else if (item.ui_status === "soon") cardClass.push("soon")
  else if (item.ui_status === "submitted") cardClass.push("submitted")
  else if (item.ui_status === "reviewed") cardClass.push("graded")

  const dateCls = ["hw-date", dateSquareClass(item.ui_status)].filter(Boolean).join(" ")

  const canSubmit =
    item.ui_status === "todo" ||
    item.ui_status === "soon" ||
    item.ui_status === "overdue"

  return (
    <div className={cardClass.join(" ")}>
      <div className={dateCls}>
        <div className="hw-date-day">{day}</div>
        <div className="hw-date-mon">{mon}</div>
        {dateStatus ? <div className="hw-date-status">{dateStatus}</div> : null}
      </div>
      <div className="hw-body">
        <div className="hw-status-row">
          <span className={`hw-status ${pill.cls}`}>{pill.text}</span>
          {item.lesson_at ? (
            <span className="hw-lesson-tag">
              К уроку с <b>{item.teacher_name}</b> ·{" "}
              {format(new Date(item.lesson_at), "d MMM", { locale: ru })}
            </span>
          ) : (
            <span className="hw-lesson-tag">
              От <b>{item.teacher_name}</b>
            </span>
          )}
        </div>
        <div className="hw-title">{item.title}</div>
        {item.description ? <div className="hw-desc">{item.description}</div> : null}
        <div className="hw-meta">
          <span className="m-item">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <b>до {formatDateInputLocal(item.due_date)}</b>
          </span>
          {item.attachments.length > 0 ? (
            <span className="m-item">
              <svg viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {item.attachments.length === 1
                ? "1 файл"
                : `${item.attachments.length} файлов`}
            </span>
          ) : null}
          {item.ui_status === "submitted" ? (
            <span className="m-item">XP зачислится после проверки</span>
          ) : null}
        </div>

        {item.ui_status === "reviewed" && item.teacher_feedback ? (
          <div className="hw-feedback">
            <b>{item.teacher_name}:</b> {item.teacher_feedback}
          </div>
        ) : null}
      </div>

      {item.ui_status === "reviewed" ? (
        <div className={`hw-grade ${gradeColorClass(item.score_10)}`}>
          <div className="hw-grade-num">
            {item.score_10 !== null
              ? Number.isInteger(item.score_10)
                ? String(item.score_10)
                : item.score_10.toFixed(1)
              : item.grade !== null
                ? Math.round(item.grade / 10)
                : "–"}
          </div>
          <div className="hw-grade-lbl">/ 10</div>
        </div>
      ) : (
        <div className="hw-cta">
          {canSubmit ? (
            <>
              <button
                type="button"
                className={item.ui_status === "overdue" ? "btn btn-red" : "btn btn-dark"}
                onClick={onSubmit}
              >
                Сдать работу
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpen}>
                Открыть
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={onOpen}>
                Посмотреть работу
              </button>
              <span className="hw-cta-hint">нельзя редактировать</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SubmitModal({
  item,
  busy,
  setBusy,
  onClose,
  onSubmitted,
}: {
  item: HwItem
  busy: boolean
  setBusy: (b: boolean) => void
  onClose: () => void
  onSubmitted: () => void
}) {
  const [text, setText] = useState(item.submission_text || "")
  const [linkName, setLinkName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [links, setLinks] = useState<Attachment[]>([])

  function addLink() {
    const url = linkUrl.trim()
    if (!url) return
    // basic URL check
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Ссылка должна начинаться с http(s)://")
      return
    }
    const name = linkName.trim() || url.replace(/^https?:\/\//i, "").slice(0, 60)
    setLinks((prev) => [...prev, { name, url }])
    setLinkName("")
    setLinkUrl("")
  }

  async function submit() {
    if (busy) return
    if (!text.trim() && links.length === 0) {
      toast.error("Прикрепи ссылку или напиши ответ")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/student/homework/${item.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_text: text || null,
          attachments: links.length > 0 ? links : undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j?.error || "Не удалось отправить задание")
        return
      }
      onSubmitted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Сдать работу</h2>
        <div className="modal-sub">{item.title}</div>

        <div className="field">
          <label>Ответ</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напиши ответ, пришли текст, ссылку на документ или расскажи, что сделал"
            rows={6}
          />
        </div>

        <div className="field">
          <label>Прикрепить ссылку (Google Docs, файл)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <input
              type="text"
              placeholder="Название"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
            />
            <input
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addLink}>
              +
            </button>
          </div>
          <div className="hint">Можно добавить несколько ссылок</div>
        </div>

        {links.length > 0 ? (
          <div className="field">
            <label>Что прикреплено</label>
            {links.map((l, i) => (
              <div className="attach-row" key={i}>
                <span className="nm">{l.name}</span>
                <button
                  type="button"
                  className="rm"
                  onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Убрать"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-lime" onClick={submit} disabled={busy}>
            {busy ? "Отправляю…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewModal({ item, onClose }: { item: HwItem; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{item.title}</h2>
        <div className="modal-sub">
          От {item.teacher_name} · до {formatDateInputLocal(item.due_date)}
        </div>

        {item.description ? (
          <div className="field">
            <label>Описание</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.description}
            </div>
          </div>
        ) : null}

        {item.attachments.length > 0 ? (
          <div className="field">
            <label>Материалы преподавателя</label>
            {item.attachments.map((a, i) => (
              <div className="attach-row" key={i}>
                <span className="nm">
                  <a href={a.url} target="_blank" rel="noreferrer noopener">
                    {a.name}
                  </a>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {item.submission_text ? (
          <div className="field">
            <label>Твой ответ</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.submission_text}
            </div>
          </div>
        ) : null}

        {item.ui_status === "reviewed" && item.teacher_feedback ? (
          <div className="field">
            <label>Комментарий преподавателя</label>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                padding: 12,
                background: "var(--bg)",
                borderRadius: 10,
              }}
            >
              {item.teacher_feedback}
            </div>
            {item.score_10 !== null ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--muted)",
                  fontWeight: 700,
                }}
              >
                Оценка: <b style={{ color: "var(--text)" }}>{item.score_10}/10</b>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
