// @ts-nocheck
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

const CSS = `
.adm-clubs{max-width:1200px;margin:0 auto}

.adm-clubs .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-clubs .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-clubs .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}

.adm-clubs .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none}
.adm-clubs .btn:disabled{opacity:.55;cursor:not-allowed}
.adm-clubs .btn-sm{padding:6px 14px;font-size:12px}
.adm-clubs .btn-primary{background:var(--accent-dark);color:#fff}
.adm-clubs .btn-primary:hover{background:var(--red)}
.adm-clubs .btn-red{background:var(--red);color:#fff}
.adm-clubs .btn-lime{background:var(--lime);color:#0A0A0A}
.adm-clubs .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-clubs .btn-secondary:hover{border-color:var(--text)}

.adm-clubs .clubs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.adm-clubs .club-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;transition:border-color .15s}
.adm-clubs .club-card:hover{border-color:var(--text)}
.adm-clubs .club-card .title{font-size:16px;font-weight:800;color:var(--text);letter-spacing:-.2px;line-height:1.3}
.adm-clubs .club-card .desc{font-size:12px;color:var(--muted);line-height:1.45;min-height:34px}
.adm-clubs .club-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted);font-weight:600;margin-top:auto;padding-top:10px;border-top:1px solid var(--border)}
.adm-clubs .club-meta b{color:var(--text);font-weight:700}

.adm-clubs .club-status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
.adm-clubs .club-status.published{background:rgba(34,197,94,.1);color:#22c55e}
[data-theme="dark"] .adm-clubs .club-status.published{background:rgba(34,197,94,.15)}
.adm-clubs .club-status.draft{background:var(--bg);color:var(--muted)}
.adm-clubs .club-status.cancelled{background:rgba(230,57,70,.1);color:var(--red)}
.adm-clubs .club-status.completed{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .adm-clubs .club-status.completed{background:var(--red)}

.adm-clubs .capacity-bar{height:6px;background:var(--bg);border-radius:3px;overflow:hidden;margin-top:4px}
.adm-clubs .capacity-bar .fill{height:100%;background:var(--lime);transition:width .2s}
.adm-clubs .capacity-bar .fill.hot{background:var(--red)}

.adm-clubs .club-actions{display:flex;gap:8px;flex-wrap:wrap}

.adm-clubs .empty{padding:60px 16px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.adm-clubs .empty b{display:block;color:var(--text);font-size:16px;margin-bottom:4px}

.adm-clubs .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:clFade .15s ease}
@keyframes clFade{from{opacity:0}to{opacity:1}}
.adm-clubs .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:560px;max-height:90vh;overflow:auto;padding:24px;color:var(--text);position:relative}
.adm-clubs .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.adm-clubs .modal-card .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.adm-clubs .modal-card .close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:var(--bg);border:none;cursor:pointer;color:var(--muted);font-size:18px}

.adm-clubs .field{margin-bottom:14px}
.adm-clubs .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.adm-clubs .field input,.adm-clubs .field select,.adm-clubs .field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;transition:border-color .15s}
.adm-clubs .field input:focus,.adm-clubs .field select:focus,.adm-clubs .field textarea:focus{outline:none;border-color:var(--text)}
.adm-clubs .field textarea{resize:vertical;min-height:100px}
.adm-clubs .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}

.adm-clubs .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
.adm-clubs .modal-actions .left{margin-right:auto}

.adm-clubs .hero-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px}

.adm-clubs .parts{margin-top:6px;display:flex;flex-direction:column;gap:6px}
.adm-clubs .parts-toggle{background:transparent;border:none;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;text-align:left;padding:0;letter-spacing:.3px;text-transform:uppercase}
.adm-clubs .parts-toggle:hover{color:var(--text)}
.adm-clubs .parts-list{display:flex;flex-direction:column;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px}
.adm-clubs .parts-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);min-width:0}
.adm-clubs .parts-row .pa-av{width:22px;height:22px;border-radius:50%;background:var(--accent-dark);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.adm-clubs .parts-row .pa-av img{width:100%;height:100%;object-fit:cover}
.adm-clubs .parts-row .pa-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.adm-clubs .parts-row .pa-st{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.adm-clubs .parts-empty{font-size:11px;color:var(--muted);font-style:italic;padding:6px 0}
`

type Participant = {
  id: string | null
  full_name: string | null
  avatar_url: string | null
  email: string | null
  status: string
  registered_at: string | null
}

type Club = {
  id: string
  title: string
  description: string | null
  level: string | null
  scheduled_at: string
  duration_minutes: number
  capacity: number
  registered_count: number
  host_teacher_id: string | null
  host_teacher_name: string | null
  status: "draft" | "published" | "cancelled" | "completed"
  participants?: Participant[]
}

type TeacherOption = {
  id: string
  full_name: string
}

type FormState = {
  id?: string
  title: string
  description: string
  level: string
  scheduled_at: string
  duration_minutes: number
  capacity: number
  host_teacher_id: string
  status: Club["status"]
}

const ROAST_LEVELS = [
  "Raw",
  "Rare",
  "Medium Rare",
  "Medium",
  "Medium Well",
  "Well Done",
] as const

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  level: "Medium",
  scheduled_at: "",
  duration_minutes: 60,
  capacity: 10,
  host_teacher_id: "",
  status: "published",
}

function statusLabel(s: string): string {
  switch (s) {
    case "published":
      return "опубликован"
    case "draft":
      return "черновик"
    case "cancelled":
      return "отменён"
    case "completed":
      return "завершён"
    default:
      return s
  }
}

function toLocalInput(iso: string): string {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

export default function AdminClubsClient({
  initial,
}: {
  initial: { clubs: Club[]; teachers: TeacherOption[] }
}) {
  const [clubs, setClubs] = useState<Club[]>(initial.clubs)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [assignFor, setAssignFor] = useState<Club | null>(null)
  const [assignIds, setAssignIds] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const refreshClubs = async () => {
    try {
      const res = await fetch(`/api/admin/clubs`, { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json?.clubs)) setClubs(json.clubs)
    } catch {}
  }

  const openNew = () => {
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (c: Club) => {
    if (c.scheduled_at && new Date(c.scheduled_at).getTime() <= Date.now()) {
      toast.error("Клуб уже начался — редактировать нельзя.")
      return
    }
    setForm({
      id: c.id,
      title: c.title,
      description: c.description || "",
      level: (c.level as any) || "Medium",
      scheduled_at: toLocalInput(c.scheduled_at),
      duration_minutes: c.duration_minutes,
      capacity: c.capacity,
      host_teacher_id: c.host_teacher_id || "",
      status: c.status,
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setSaving(false)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Укажите название клуба")
      return
    }
    if (!form.scheduled_at) {
      toast.error("Укажите дату и время")
      return
    }
    if (form.capacity > 15) {
      toast.error("Максимальная вместимость — 15 участников")
      return
    }
    setSaving(true)
    try {
      const scheduled_at = new Date(form.scheduled_at).toISOString()
      const body: Record<string, any> = {
        title: form.title,
        description: form.description || null,
        level: form.level,
        scheduled_at,
        duration_minutes: form.duration_minutes,
        capacity: form.capacity,
        host_teacher_id: form.host_teacher_id || null,
        is_published: form.status === "published",
      }
      if (form.id) {
        body.cancelled = form.status === "cancelled"
      }
      const url = form.id
        ? `/api/admin/clubs/${form.id}`
        : `/api/admin/clubs`
      const method = form.id ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error((await res.json())?.error || "Ошибка сохранения")
      }
      const json = await res.json()
      const savedClub = json.club as Club
      if (form.id) {
        setClubs((cur) =>
          cur.map((c) => (c.id === form.id ? { ...c, ...savedClub } : c))
        )
        toast.success("Клуб обновлён")
      } else {
        setClubs((cur) => [savedClub, ...cur])
        toast.success("Клуб создан")
      }
      closeForm()
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const openAssign = (c: Club) => {
    setAssignFor(c)
    setAssignIds("")
  }

  const closeAssign = () => {
    setAssignFor(null)
    setAssigning(false)
  }

  const handleAssign = async () => {
    if (!assignFor) return
    const ids = assignIds
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      toast.error("Введите хотя бы один ID ученика")
      return
    }
    setAssigning(true)
    try {
      const res = await fetch(`/api/admin/clubs/${assignFor.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: ids }),
      })
      if (!res.ok) {
        throw new Error((await res.json())?.error || "Ошибка назначения")
      }
      const json = await res.json()
      const addedCount = json.added ?? ids.length
      toast.success(`Добавлено ${addedCount} участников`)
      setClubs((cur) =>
        cur.map((c) =>
          c.id === assignFor.id
            ? {
                ...c,
                registered_count: Math.min(
                  c.capacity,
                  c.registered_count + addedCount
                ),
              }
            : c
        )
      )
      closeAssign()
      // Refresh from server so registered_count + participants reflect reality.
      void refreshClubs()
    } catch (e: any) {
      toast.error(e?.message || "Ошибка")
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="adm-clubs">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="page-hdr">
        <div>
          <h1>Speaking <span className="gl">Clubs</span></h1>
          <div className="sub">Всего: {clubs.length}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin" className="btn btn-sm btn-secondary">
            ← На главную
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void refreshClubs()}
            title="Перезагрузить список"
          >
            ⟳ Обновить
          </button>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            + Новый клуб
          </button>
        </div>
      </div>

      {clubs.length === 0 ? (
        <div className="empty">
          <b>Клубов ещё нет</b>
          Создайте первый speaking club кнопкой выше
        </div>
      ) : (
        <div className="clubs-grid">
          {clubs.map((c) => {
            const pct = Math.round(
              Math.min(100, (c.registered_count / Math.max(1, c.capacity)) * 100)
            )
            const hot = pct >= 80
            return (
              <div key={c.id} className="club-card">
                <div className="hero-top">
                  <span className={`club-status ${c.status}`}>
                    {statusLabel(c.status)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 700,
                    }}
                  >
                    {c.level || "—"}
                  </span>
                </div>
                <div className="title">{c.title}</div>
                <div className="desc">{c.description || "—"}</div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    Участники: {c.registered_count}/{c.capacity}
                  </div>
                  <div className="capacity-bar">
                    <div
                      className={`fill${hot ? " hot" : ""}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
                <div className="club-meta">
                  <span>
                    📅{" "}
                    <b>
                      {c.scheduled_at
                        ? format(new Date(c.scheduled_at), "d MMM, HH:mm", {
                            locale: ru,
                          })
                        : "—"}
                    </b>
                  </span>
                  <span>
                    ⏱️ <b>{c.duration_minutes} мин</b>
                  </span>
                  {c.host_teacher_name && (
                    <span>
                      👤 <b>{c.host_teacher_name}</b>
                    </span>
                  )}
                </div>
                <div className="parts">
                  {c.participants && c.participants.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="parts-toggle"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))
                        }
                      >
                        {expanded[c.id] ? "▾" : "▸"} Участники (
                        {c.participants.length})
                      </button>
                      {expanded[c.id] ? (
                        <div className="parts-list">
                          {c.participants.map((p, i) => {
                            const initials =
                              (p.full_name || "")
                                .split(" ")
                                .filter(Boolean)
                                .map((s) => s[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "??"
                            return (
                              <div
                                key={(p.id ?? "") + i}
                                className="parts-row"
                                title={p.email || ""}
                              >
                                <div className="pa-av">
                                  {p.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.avatar_url}
                                      alt={p.full_name || ""}
                                    />
                                  ) : (
                                    initials
                                  )}
                                </div>
                                <div className="pa-name">
                                  {p.full_name || p.email || "—"}
                                </div>
                                <div className="pa-st">{p.status}</div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="parts-empty">Пока никто не записался</div>
                  )}
                </div>
                <div className="club-actions">
                  {c.scheduled_at &&
                  new Date(c.scheduled_at).getTime() <= Date.now() ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        fontWeight: 600,
                        padding: "6px 14px",
                      }}
                    >
                      🔒 Уже начался
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => openEdit(c)}
                    >
                      Редактировать
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-lime"
                    onClick={() => openAssign(c)}
                    disabled={c.registered_count >= c.capacity}
                  >
                    Добавить учеников
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm()
          }}
        >
          <div className="modal-card">
            <button
              type="button"
              className="close"
              onClick={closeForm}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2>{form.id ? "Редактировать клуб" : "Новый клуб"}</h2>
            <div className="modal-sub">
              Вместимость — до 15 участников
            </div>
            <div className="field">
              <label>Название</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Pitch night: представь себя"
              />
            </div>
            <div className="field">
              <label>Описание</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Коротко о чём клуб..."
              />
            </div>
            <div className="row2">
              <div className="field">
                <label>Дата и время</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) =>
                    setForm({ ...form, scheduled_at: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label>Длительность (мин)</label>
                <input
                  type="number"
                  min={15}
                  max={180}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_minutes: Number(e.target.value) || 60,
                    })
                  }
                />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Уровень</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                >
                  {ROAST_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Вместимость (макс 15)</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      capacity: Math.min(15, Number(e.target.value) || 1),
                    })
                  }
                />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Преподаватель</label>
                <select
                  value={form.host_teacher_id}
                  onChange={(e) =>
                    setForm({ ...form, host_teacher_id: e.target.value })
                  }
                >
                  <option value="">— Не назначен —</option>
                  {initial.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Статус</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as any })
                  }
                >
                  <option value="published">опубликован</option>
                  <option value="draft">черновик</option>
                  {form.id ? <option value="cancelled">отменён</option> : null}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary left"
                onClick={closeForm}
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

      {assignFor && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAssign()
          }}
        >
          <div className="modal-card">
            <button
              type="button"
              className="close"
              onClick={closeAssign}
              aria-label="Закрыть"
            >
              ×
            </button>
            <h2>Добавить учеников</h2>
            <div className="modal-sub">
              {assignFor.title} · свободно{" "}
              {Math.max(0, assignFor.capacity - assignFor.registered_count)}{" "}
              мест
            </div>
            <div className="field">
              <label>ID учеников (через запятую, пробел или с новой строки)</label>
              <textarea
                value={assignIds}
                onChange={(e) => setAssignIds(e.target.value)}
                placeholder="uuid-1, uuid-2, uuid-3"
                style={{ minHeight: 120 }}
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary left"
                onClick={closeAssign}
                disabled={assigning}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={assigning}
              >
                {assigning ? "Добавляю..." : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
