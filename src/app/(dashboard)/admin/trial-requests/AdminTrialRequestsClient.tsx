// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

const CSS = `
.adm-trial{max-width:1200px;margin:0 auto}

.adm-trial .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-trial .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-trial .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.adm-trial .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:100px;padding:4px;margin-bottom:20px;width:fit-content;max-width:100%;overflow-x:auto}
.adm-trial .filter-tabs button{padding:8px 16px;border-radius:100px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border:none;background:none;cursor:pointer;font-family:inherit}
.adm-trial .filter-tabs button:hover{color:var(--text)}
.adm-trial .filter-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-trial .filter-tabs button.active{background:var(--red)}
.adm-trial .filter-tabs .count{background:rgba(0,0,0,.08);padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .adm-trial .filter-tabs .count{background:rgba(255,255,255,.08)}
.adm-trial .filter-tabs button.active .count{background:rgba(255,255,255,.22)}

.adm-trial .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.adm-trial .apps-list{display:flex;flex-direction:column}
.adm-trial .app-item{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);transition:background .15s ease;cursor:pointer}
.adm-trial .app-item:last-child{border-bottom:none}
.adm-trial .app-item:hover{background:var(--surface-2)}
.adm-trial .app-item.hot{background:rgba(230,57,70,.04)}
[data-theme="dark"] .adm-trial .app-item.hot{background:rgba(230,57,70,.08)}
.adm-trial .app-avatar{width:42px;height:42px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;color:var(--text)}
.adm-trial .app-avatar.red{background:var(--red);color:#fff}
.adm-trial .app-avatar.lime{background:var(--lime);color:#0A0A0A}
.adm-trial .app-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-trial .app-avatar.dark{background:var(--red)}
.adm-trial .app-info{flex:1;min-width:0}
.adm-trial .app-info h4{font-size:14px;font-weight:700;margin-bottom:2px;color:var(--text)}
.adm-trial .app-info p{font-size:12px;color:var(--muted);line-height:1.4}
.adm-trial .app-status{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.adm-trial .app-status-new{background:var(--red);color:#fff}
.adm-trial .app-status-processing{background:rgba(245,158,11,.15);color:#B8860B}
.adm-trial .app-status-matched{background:rgba(34,197,94,.1);color:#22c55e}
[data-theme="dark"] .adm-trial .app-status-matched{background:rgba(34,197,94,.15)}
.adm-trial .app-status-done{background:var(--bg);color:var(--muted)}
.adm-trial .app-status-cancelled{background:var(--bg);color:var(--muted);text-decoration:line-through}
.adm-trial .app-meta{font-size:11px;color:var(--muted);white-space:nowrap}

.adm-trial .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px}
.adm-trial .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

.adm-trial .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.adm-trial .btn:disabled{opacity:.55;cursor:not-allowed}
.adm-trial .btn-sm{padding:6px 14px;font-size:12px}
.adm-trial .btn-primary{background:var(--accent-dark);color:#fff}
.adm-trial .btn-primary:hover{background:var(--red)}
.adm-trial .btn-red{background:var(--red);color:#fff}
.adm-trial .btn-red:hover{filter:brightness(.9)}
.adm-trial .btn-lime{background:var(--lime);color:#0A0A0A}
.adm-trial .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-trial .btn-secondary:hover{border-color:var(--text)}

.adm-trial .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:trFade .15s ease}
@keyframes trFade{from{opacity:0}to{opacity:1}}
.adm-trial .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:560px;max-height:90vh;overflow:auto;padding:24px;color:var(--text)}
.adm-trial .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.adm-trial .modal-card .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.adm-trial .modal-card .close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:var(--bg);border:none;cursor:pointer;color:var(--muted);font-size:18px}

.adm-trial .field{margin-bottom:14px}
.adm-trial .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.adm-trial .field input,.adm-trial .field select,.adm-trial .field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;transition:border-color .15s}
.adm-trial .field input:focus,.adm-trial .field select:focus,.adm-trial .field textarea:focus{outline:none;border-color:var(--text)}
.adm-trial .field textarea{resize:vertical;min-height:80px}

.adm-trial .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;padding:14px;background:var(--bg);border-radius:12px}
.adm-trial .info-grid .info-item label{display:block;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.adm-trial .info-grid .info-item div{font-size:13px;font-weight:700;color:var(--text)}

.adm-trial .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
.adm-trial .modal-actions .left{margin-right:auto}
`

type TrialRequest = {
  id: string
  student_id: string | null
  student_name: string
  student_email: string | null
  student_phone: string | null
  level: string | null
  goal: string | null
  preferred_slot: string | null
  notes: string | null
  status: "new" | "processing" | "matched" | "done" | "cancelled"
  assigned_teacher_id: string | null
  assigned_teacher_name: string | null
  created_at: string
  updated_at: string
}

type TeacherOption = {
  id: string
  full_name: string
  level_range: string | null
}

type FilterKey = "all" | "new" | "processing" | "matched" | "done"

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
    if (m < 60) return `${m} мин назад`
    const h = Math.round(m / 60)
    if (h < 24) return `${h} ч назад`
    const dd = Math.round(h / 24)
    return `${dd} дн назад`
  } catch {
    return ""
  }
}

function statusLabel(s: string): { cls: string; text: string } {
  switch (s) {
    case "new":
      return { cls: "app-status-new", text: "новая" }
    case "processing":
      return { cls: "app-status-processing", text: "в работе" }
    case "matched":
      return { cls: "app-status-matched", text: "✓ подобрали" }
    case "done":
      return { cls: "app-status-done", text: "готово" }
    case "cancelled":
      return { cls: "app-status-cancelled", text: "отмена" }
    default:
      return { cls: "app-status-done", text: s }
  }
}

export default function AdminTrialRequestsClient({
  initial,
}: {
  initial: { requests: TrialRequest[]; teachers: TeacherOption[] }
}) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [requests, setRequests] = useState<TrialRequest[]>(initial.requests)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editStatus, setEditStatus] = useState<TrialRequest["status"]>("new")
  const [editTeacher, setEditTeacher] = useState<string>("")
  const [editNotes, setEditNotes] = useState<string>("")

  const counts = useMemo(() => {
    const c = { all: requests.length, new: 0, processing: 0, matched: 0, done: 0 }
    for (const r of requests) {
      if (r.status === "new") c.new++
      else if (r.status === "processing") c.processing++
      else if (r.status === "matched") c.matched++
      else if (r.status === "done") c.done++
    }
    return c
  }, [requests])

  const filtered = useMemo(() => {
    if (filter === "all") return requests
    return requests.filter((r) => r.status === filter)
  }, [requests, filter])

  const active = requests.find((r) => r.id === activeId) || null

  const openEdit = (r: TrialRequest) => {
    setActiveId(r.id)
    setEditStatus(r.status)
    setEditTeacher(r.assigned_teacher_id || "")
    setEditNotes(r.notes || "")
  }

  const closeEdit = () => {
    setActiveId(null)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!active) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/trial-requests/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes,
          assigned_teacher_id: editTeacher || null,
        }),
      })
      if (!res.ok) {
        throw new Error((await res.json())?.error || "Ошибка сохранения")
      }
      const json = await res.json()
      const updated = json.request as TrialRequest
      setRequests((cur) =>
        cur.map((r) =>
          r.id === active.id
            ? {
                ...r,
                status: editStatus,
                notes: editNotes,
                assigned_teacher_id: editTeacher || null,
                assigned_teacher_name: updated?.assigned_teacher_name ?? r.assigned_teacher_name,
              }
            : r
        )
      )
      toast.success("Заявка обновлена")
      closeEdit()
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="adm-trial">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Заявки на пробный урок</h1>
          <div className="sub">
            Всего: {requests.length} · новых: {counts.new} · в работе:{" "}
            {counts.processing}
          </div>
        </div>
        <div>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
        </div>
      </div>

      <div className="filter-tabs">
        {(
          [
            { k: "all", label: "Все", count: counts.all },
            { k: "new", label: "Новые", count: counts.new },
            { k: "processing", label: "В работе", count: counts.processing },
            { k: "matched", label: "Подобраны", count: counts.matched },
            { k: "done", label: "Готово", count: counts.done },
          ] as { k: FilterKey; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            className={filter === t.k ? "active" : ""}
            onClick={() => setFilter(t.k)}
          >
            {t.label}
            <span className="count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <b>{requests.length === 0 ? "Данные подгружаются" : "Нет заявок"}</b>
            {requests.length === 0
              ? "API /api/admin/trial-requests может быть ещё не готов"
              : "В этой категории пока пусто"}
          </div>
        ) : (
          <div className="apps-list">
            {filtered.map((r, i) => {
              const st = statusLabel(r.status)
              const hot = r.status === "new"
              return (
                <div
                  key={r.id}
                  className={`app-item${hot ? " hot" : ""}`}
                  onClick={() => openEdit(r)}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className={`app-avatar ${
                      AVATAR_STYLES[i % AVATAR_STYLES.length]
                    }`}
                  >
                    {initialsOf(r.student_name)}
                  </div>
                  <div className="app-info">
                    <h4>{r.student_name}</h4>
                    <p>
                      {[r.level, r.goal, r.preferred_slot]
                        .filter(Boolean)
                        .join(" · ") || "Без дополнительной информации"}
                      {r.assigned_teacher_name
                        ? ` · препод: ${r.assigned_teacher_name}`
                        : ""}
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

      {active && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit()
          }}
        >
          <div className="modal-card" style={{ position: "relative" }}>
            <button
              type="button"
              className="close"
              onClick={closeEdit}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2>{active.student_name}</h2>
            <div className="modal-sub">
              Заявка от {timeAgoRu(active.created_at)}
            </div>

            <div className="info-grid">
              <div className="info-item">
                <label>Уровень</label>
                <div>{active.level || "—"}</div>
              </div>
              <div className="info-item">
                <label>Цель</label>
                <div>{active.goal || "—"}</div>
              </div>
              <div className="info-item">
                <label>Удобное время</label>
                <div>{active.preferred_slot || "—"}</div>
              </div>
              <div className="info-item">
                <label>Контакты</label>
                <div style={{ fontSize: 11, fontWeight: 500 }}>
                  {active.student_email || "—"}
                  {active.student_phone ? ` · ${active.student_phone}` : ""}
                </div>
              </div>
            </div>

            <div className="field">
              <label>Статус</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
              >
                <option value="new">новая</option>
                <option value="processing">в работе</option>
                <option value="matched">подобрали</option>
                <option value="done">готово</option>
                <option value="cancelled">отмена</option>
              </select>
            </div>

            <div className="field">
              <label>Преподаватель</label>
              <select
                value={editTeacher}
                onChange={(e) => setEditTeacher(e.target.value)}
              >
                <option value="">— Не назначен —</option>
                {initial.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                    {t.level_range ? ` (${t.level_range})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Заметки администратора</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Внутренние заметки..."
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary left"
                onClick={closeEdit}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
