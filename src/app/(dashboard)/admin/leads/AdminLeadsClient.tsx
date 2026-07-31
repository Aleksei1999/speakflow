// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

const CSS = `
.adm-leads{max-width:1200px;margin:0 auto}
.adm-leads .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-leads .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-leads .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}
.adm-leads .tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:10px}
.adm-leads .tab{background:transparent;border:1px solid var(--border);color:var(--muted);font-weight:600;font-size:12px;padding:6px 14px;border-radius:999px;cursor:pointer;transition:all .15s}
.adm-leads .tab:hover{border-color:var(--text);color:var(--text)}
.adm-leads .tab.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
[data-theme="dark"] .adm-leads .tab.active{background:var(--red);border-color:var(--red)}
.adm-leads .grid{display:flex;flex-direction:column;gap:10px}
.adm-leads .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:12px}
.adm-leads .card .name{font-size:15px;font-weight:800;letter-spacing:-.2px;color:var(--text)}
.adm-leads .card .meta{font-size:12px;color:var(--muted);margin-top:6px;display:flex;gap:12px;flex-wrap:wrap}
.adm-leads .card .meta a{color:var(--text);text-decoration:none;font-weight:600}
.adm-leads .card .meta a:hover{text-decoration:underline}
.adm-leads .card .meta .tag{background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:var(--text)}
.adm-leads .right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:180px}
.adm-leads .stat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:4px 10px;border-radius:999px}
.adm-leads .stat.new{background:rgba(59,130,246,.12);color:#3B82F6}
.adm-leads .stat.contacted{background:rgba(34,197,94,.12);color:#22C55E}
.adm-leads .stat.archived{background:var(--bg);color:var(--muted)}
.adm-leads .when{font-size:11px;color:var(--muted);font-weight:600}
.adm-leads select.status-select{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px 10px;font-size:12px;color:var(--text);font-family:inherit;font-weight:600;cursor:pointer}
.adm-leads .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.adm-leads .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}
`

type Lead = {
  id: string
  name: string
  email: string
  phone: string
  marketing_opt_in: boolean
  source: string
  country: string | null
  status: "new" | "contacted" | "archived"
  admin_notes: string | null
  created_at: string
}

const STATUSES: Array<{ v: "all" | Lead["status"]; label: string }> = [
  { v: "all", label: "Все" },
  { v: "new", label: "Новые" },
  { v: "contacted", label: "Связался" },
  { v: "archived", label: "Архив" },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString("ru", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
  } catch { return iso }
}

export default function AdminLeadsClient({ initial }: { initial: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initial)
  const [tab, setTab] = useState<"all" | Lead["status"]>("all")

  const filtered = useMemo(() => tab === "all" ? leads : leads.filter(l => l.status === tab), [leads, tab])
  const counts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    archived: leads.filter(l => l.status === "archived").length,
  }), [leads])

  async function updateStatus(id: string, status: Lead["status"]) {
    const prev = leads.find(l => l.id === id)?.status
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l))
    try {
      const res = await fetch(`/api/admin/leads/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success("Статус обновлён")
    } catch {
      setLeads(ls => ls.map(l => l.id === id ? { ...l, status: prev ?? "new" } : l))
      toast.error("Не удалось обновить статус")
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="adm-leads">
        <div className="page-hdr">
          <div>
            <h1>Лиды с лендинга</h1>
            <p className="sub">Заявки из формы «Оставь свои данные».</p>
          </div>
        </div>

        <div className="tabs">
          {STATUSES.map(s => (
            <button
              key={s.v}
              type="button"
              className={`tab ${tab === s.v ? "active" : ""}`}
              onClick={() => setTab(s.v)}
            >
              {s.label} · {counts[s.v]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <b>Пусто</b>
            {tab === "all" ? "Пока ни одной заявки" : "Нет заявок с таким статусом"}
          </div>
        ) : (
          <div className="grid">
            {filtered.map(l => (
              <div className="card" key={l.id}>
                <div>
                  <div className="name">{l.name}</div>
                  <div className="meta">
                    <a href={`mailto:${l.email}`}>📧 {l.email}</a>
                    <a href={`tel:${l.phone.replace(/\s/g, "")}`}>📱 {l.phone}</a>
                    {l.country && <span className="tag">{l.country}</span>}
                    {l.marketing_opt_in && <span className="tag">маркетинг ✓</span>}
                    <span className="tag">{l.source}</span>
                  </div>
                </div>
                <div className="right">
                  <span className={`stat ${l.status}`}>{l.status}</span>
                  <select
                    className="status-select"
                    value={l.status}
                    onChange={e => updateStatus(l.id, e.target.value as Lead["status"])}
                  >
                    <option value="new">Новый</option>
                    <option value="contacted">Связался</option>
                    <option value="archived">В архив</option>
                  </select>
                  <span className="when">{fmtDate(l.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
