// @ts-nocheck
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

const CSS = `
.adm-apps{max-width:1200px;margin:0 auto}
.adm-apps .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-apps .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-apps .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}
.adm-apps .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.adm-apps .btn-sm{padding:6px 14px;font-size:12px}
.adm-apps .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-apps .btn-secondary:hover{border-color:var(--text)}

.adm-apps .tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:10px}
.adm-apps .tab{background:transparent;border:1px solid var(--border);color:var(--muted);font-weight:600;font-size:12px;padding:6px 14px;border-radius:999px;cursor:pointer;transition:all .15s}
.adm-apps .tab:hover{border-color:var(--text);color:var(--text)}
.adm-apps .tab.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
[data-theme="dark"] .adm-apps .tab.active{background:var(--red);border-color:var(--red)}

.adm-apps .grid{display:flex;flex-direction:column;gap:10px}
.adm-apps .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:12px}
.adm-apps .card .name{font-size:15px;font-weight:800;letter-spacing:-.2px;color:var(--text)}
.adm-apps .card .meta{font-size:12px;color:var(--muted);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap}
.adm-apps .card .meta b{color:var(--text);font-weight:600}
.adm-apps .card .notes{font-size:12px;color:var(--text);margin-top:8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px;white-space:pre-wrap}
.adm-apps .right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:170px}
.adm-apps .stat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:4px 10px;border-radius:999px}
.adm-apps .stat.new{background:rgba(59,130,246,.12);color:#3B82F6}
.adm-apps .stat.in_review{background:rgba(245,158,11,.12);color:#D97706}
.adm-apps .stat.approved{background:rgba(34,197,94,.12);color:#22C55E}
.adm-apps .stat.rejected{background:rgba(230,57,70,.12);color:var(--red)}
.adm-apps .stat.archived{background:var(--bg);color:var(--muted)}
.adm-apps select.status-select{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px 10px;font-size:12px;color:var(--text);font-family:inherit;font-weight:600;cursor:pointer}
.adm-apps .when{font-size:11px;color:var(--muted);font-weight:600}
.adm-apps .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.adm-apps .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}
`

type Application = {
  id: string
  first_name: string
  last_name: string
  email: string
  contact: string
  notes: string | null
  status: "new" | "in_review" | "approved" | "rejected" | "archived"
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_LABEL: Record<Application["status"], string> = {
  new: "Новая",
  in_review: "В работе",
  approved: "Одобрено",
  rejected: "Отказано",
  archived: "В архиве",
}

const TABS: Array<{ id: "all" | Application["status"]; label: string }> = [
  { id: "new", label: "Новые" },
  { id: "in_review", label: "В работе" },
  { id: "approved", label: "Одобрено" },
  { id: "rejected", label: "Отказано" },
  { id: "archived", label: "Архив" },
  { id: "all", label: "Все" },
]

export default function AdminTrialRequestsClient({
  initial,
}: {
  initial: Application[]
}) {
  const [items, setItems] = useState<Application[]>(initial)
  const [tab, setTab] = useState<"all" | Application["status"]>("new")
  const [refreshing, setRefreshing] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      new: 0,
      in_review: 0,
      approved: 0,
      rejected: 0,
      archived: 0,
      all: items.length,
    }
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1
    return c
  }, [items])

  const filtered = useMemo(() => {
    if (tab === "all") return items
    return items.filter((it) => it.status === tab)
  }, [items, tab])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/teacher-applications", {
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json?.applications)) setItems(json.applications)
    } catch {} finally {
      setRefreshing(false)
    }
  }

  // Auto-poll every 30s + on focus
  useEffect(() => {
    const t = setInterval(() => void refresh(), 30_000)
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  const setStatus = async (id: string, status: Application["status"]) => {
    setItems((cur) =>
      cur.map((it) => (it.id === id ? { ...it, status } : it))
    )
    try {
      const res = await fetch(`/api/admin/teacher-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось обновить статус")
        refresh()
        return
      }
      toast.success(`Статус: ${STATUS_LABEL[status]}`)
    } catch {
      toast.error("Ошибка сети")
      refresh()
    }
  }

  return (
    <div className="adm-apps">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Заявки преподавателей</h1>
          <div className="sub">
            Всего: {counts.all} · новых: {counts.new} · в работе:{" "}
            {counts.in_review} · одобрено: {counts.approved}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Обновляю…" : "⟳ Обновить"}
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <b>Заявок нет</b>В этой категории пока пусто.
        </div>
      ) : (
        <div className="grid">
          {filtered.map((it) => {
            const fullName = `${it.first_name} ${it.last_name}`.trim()
            const when = (() => {
              try {
                return format(new Date(it.created_at), "d MMM, HH:mm", {
                  locale: ru,
                })
              } catch {
                return ""
              }
            })()
            return (
              <div key={it.id} className="card">
                <div>
                  <div className="name">{fullName || "—"}</div>
                  <div className="meta">
                    <span>
                      📧{" "}
                      <a
                        href={`mailto:${it.email}`}
                        style={{ color: "inherit" }}
                      >
                        {it.email}
                      </a>
                    </span>
                    <span>
                      📱 <b>{it.contact}</b>
                    </span>
                    <span className="when">{when}</span>
                  </div>
                  {it.notes ? <div className="notes">{it.notes}</div> : null}
                </div>
                <div className="right">
                  <span className={`stat ${it.status}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                  <select
                    className="status-select"
                    value={it.status}
                    onChange={(e) =>
                      setStatus(it.id, e.target.value as Application["status"])
                    }
                  >
                    <option value="new">Новая</option>
                    <option value="in_review">В работе</option>
                    <option value="approved">Одобрено</option>
                    <option value="rejected">Отказано</option>
                    <option value="archived">В архив</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
