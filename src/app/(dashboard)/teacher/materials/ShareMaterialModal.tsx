// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type Student = {
  id: string
  full_name: string
  avatar_url: string | null
  english_level: string | null
}

type Homework = {
  id: string
  title: string
  student_name?: string | null
  due_at?: string | null
}

type Group = {
  id: string
  name: string
  description: string | null
  member_count: number
  created_at: string
}

type ExistingShare = {
  id: string
  target_type: "student" | "homework" | "group" | string
  target_id: string
  target_name: string
}

type Props = {
  materialId: string
  materialTitle: string
  open: boolean
  onClose: () => void
}

type Tab = "students" | "homeworks" | "groups"

const SHARE_CSS = `
.tch-mat .share-modal{max-width:640px}
.tch-mat .share-modal h2{margin-bottom:2px}
.tch-mat .share-modal .modal-sub{margin-bottom:14px}

.tch-mat .share-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tch-mat .share-tab{padding:8px 14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--border);color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.tch-mat .share-tab:hover{color:var(--text);border-color:var(--text)}
.tch-mat .share-tab.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
[data-theme="dark"] .tch-mat .share-tab.active{background:var(--red);border-color:var(--red)}
.tch-mat .share-tab .cnt{margin-left:6px;font-size:10px;opacity:.75}

.tch-mat .share-search{width:100%;height:36px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0 12px;color:var(--text);font-family:inherit;font-size:13px;margin-bottom:10px}
.tch-mat .share-search:focus{outline:none;border-color:var(--text)}

.tch-mat .share-list{max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.tch-mat .share-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
.tch-mat .share-item:last-child{border-bottom:none}
.tch-mat .share-item:hover{background:var(--bg)}
.tch-mat .share-item.checked{background:rgba(230,57,70,.06)}
.tch-mat .share-item .chk{width:18px;height:18px;border-radius:5px;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--surface)}
.tch-mat .share-item.checked .chk{background:var(--red);border-color:var(--red);color:#fff}
.tch-mat .share-item .chk svg{width:10px;height:10px;display:none}
.tch-mat .share-item.checked .chk svg{display:block}
.tch-mat .share-item .av{width:30px;height:30px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0;object-fit:cover}
.tch-mat .share-item .info{flex:1;min-width:0}
.tch-mat .share-item .info .nm{font-size:13px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tch-mat .share-item .info .sub{font-size:11px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tch-mat .share-item .lvl{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(230,57,70,.1);color:var(--red);font-weight:700;flex-shrink:0}

.tch-mat .share-empty{padding:22px 14px;text-align:center;font-size:12px;color:var(--muted)}

.tch-mat .share-new-group{margin-top:10px;padding:14px;background:var(--surface-2);border:1px dashed var(--border);border-radius:12px}
.tch-mat .share-new-group h4{font-size:13px;font-weight:800;margin-bottom:8px}
.tch-mat .share-new-group input,.tch-mat .share-new-group textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--text);font-family:inherit;margin-bottom:8px}
.tch-mat .share-new-group .sg-actions{display:flex;gap:8px;justify-content:flex-end}

.tch-mat .share-create-btn{margin-top:8px;width:100%;padding:10px;background:var(--surface);border:1px dashed var(--border);border-radius:10px;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.tch-mat .share-create-btn:hover{color:var(--text);border-color:var(--text)}

.tch-mat .share-existing{margin-top:16px;padding-top:14px;border-top:1px solid var(--border)}
.tch-mat .share-existing-title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px}
.tch-mat .share-existing-list{display:flex;flex-wrap:wrap;gap:6px}
.tch-mat .share-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;font-size:11px;font-weight:600}
.tch-mat .share-chip .chip-type{font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:2px 6px;border-radius:6px;background:var(--bg);color:var(--muted);font-weight:700}
.tch-mat .share-chip button{width:16px;height:16px;border-radius:50%;background:var(--bg);border:none;display:flex;align-items:center;justify-content:center;color:var(--muted);cursor:pointer;padding:0}
.tch-mat .share-chip button:hover{background:var(--red);color:#fff}
.tch-mat .share-chip button svg{width:8px;height:8px}
`

function initialsOf(name: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6 L5 9 L10 3" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  )
}

export default function ShareMaterialModal({ materialId, materialTitle, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("students")
  const [search, setSearch] = useState("")

  const [students, setStudents] = useState<Student[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [shares, setShares] = useState<ExistingShare[]>([])

  const [loadingData, setLoadingData] = useState(false)

  const [selStudents, setSelStudents] = useState<Set<string>>(new Set())
  const [selHomeworks, setSelHomeworks] = useState<Set<string>>(new Set())
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set())

  // New group form
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [ngName, setNgName] = useState("")
  const [ngDesc, setNgDesc] = useState("")
  const [ngMembers, setNgMembers] = useState<Set<string>>(new Set())
  const [creatingGroup, setCreatingGroup] = useState(false)

  const [saving, setSaving] = useState(false)

  const handle401 = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/login"
  }, [])

  // Fetch students, homeworks, groups, shares
  const loadAll = useCallback(async () => {
    setLoadingData(true)
    try {
      // students
      try {
        const r = await fetch("/api/teacher/students", { cache: "no-store" })
        if (r.status === 401) return handle401()
        if (r.ok) {
          const j = await r.json()
          setStudents(Array.isArray(j.students) ? j.students : [])
        } else {
          setStudents([])
        }
      } catch {
        setStudents([])
      }

      // homeworks (may not exist)
      try {
        const r = await fetch("/api/teacher/homeworks", { cache: "no-store" })
        if (r.status === 401) return handle401()
        if (r.ok) {
          const j = await r.json()
          setHomeworks(Array.isArray(j.homeworks) ? j.homeworks : [])
        } else {
          setHomeworks([])
        }
      } catch {
        setHomeworks([])
      }

      // groups
      try {
        const r = await fetch("/api/teacher/groups", { cache: "no-store" })
        if (r.status === 401) return handle401()
        if (r.ok) {
          const j = await r.json()
          setGroups(Array.isArray(j.groups) ? j.groups : [])
        } else {
          setGroups([])
        }
      } catch {
        setGroups([])
      }

      // existing shares
      try {
        const r = await fetch(`/api/teacher/materials/${encodeURIComponent(materialId)}/share`, { cache: "no-store" })
        if (r.status === 401) return handle401()
        if (r.ok) {
          const j = await r.json()
          setShares(Array.isArray(j.shares) ? j.shares : [])
        } else {
          setShares([])
        }
      } catch {
        setShares([])
      }
    } finally {
      setLoadingData(false)
    }
  }, [materialId, handle401])

  useEffect(() => {
    if (open) {
      setTab("students")
      setSearch("")
      setSelStudents(new Set())
      setSelHomeworks(new Set())
      setSelGroups(new Set())
      setNewGroupOpen(false)
      setNgName("")
      setNgDesc("")
      setNgMembers(new Set())
      loadAll()
    }
  }, [open, loadAll])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => (s.full_name || "").toLowerCase().includes(q))
  }, [students, search])

  const filteredHomeworks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return homeworks
    return homeworks.filter((h) => (h.title || "").toLowerCase().includes(q))
  }, [homeworks, search])

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => (g.name || "").toLowerCase().includes(q))
  }, [groups, search])

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  async function createGroup() {
    if (!ngName.trim()) {
      toast.error("Введи название группы")
      return
    }
    setCreatingGroup(true)
    try {
      const res = await fetch("/api/teacher/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ngName.trim(),
          description: ngDesc.trim() || undefined,
          student_ids: Array.from(ngMembers),
        }),
      })
      if (res.status === 401) return handle401()
      if (!res.ok) {
        toast.error("Не удалось создать группу")
        return
      }
      const j = await res.json().catch(() => ({}))
      if (j?.group) {
        setGroups((prev) => [j.group, ...prev])
        setSelGroups((prev) => new Set([...prev, j.group.id]))
      }
      toast.success("Группа создана")
      setNewGroupOpen(false)
      setNgName("")
      setNgDesc("")
      setNgMembers(new Set())
    } catch {
      toast.error("Ошибка создания группы")
    } finally {
      setCreatingGroup(false)
    }
  }

  async function shareNow() {
    const body: any = {}
    if (selStudents.size) body.students = Array.from(selStudents)
    if (selHomeworks.size) body.homeworks = Array.from(selHomeworks)
    if (selGroups.size) body.groups = Array.from(selGroups)
    if (Object.keys(body).length === 0) {
      toast.error("Выбери кому поделиться")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/materials/${encodeURIComponent(materialId)}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.status === 401) return handle401()
      if (!res.ok) {
        toast.error("Не удалось поделиться")
        return
      }
      const j = await res.json().catch(() => ({}))
      const inserted = j?.inserted ?? selStudents.size + selHomeworks.size + selGroups.size
      toast.success(`Поделились: ${inserted}`)
      setSelStudents(new Set())
      setSelHomeworks(new Set())
      setSelGroups(new Set())
      // refetch shares
      try {
        const r = await fetch(`/api/teacher/materials/${encodeURIComponent(materialId)}/share`, { cache: "no-store" })
        if (r.ok) {
          const jj = await r.json()
          setShares(Array.isArray(jj.shares) ? jj.shares : [])
        }
      } catch {}
    } catch {
      toast.error("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  async function removeShare(shareId: string) {
    // optimistic
    const prev = shares
    setShares((s) => s.filter((x) => x.id !== shareId))
    try {
      const res = await fetch(`/api/teacher/materials/${encodeURIComponent(materialId)}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_ids: [shareId] }),
      })
      if (res.status === 401) return handle401()
      if (!res.ok) throw new Error("failed")
      toast.success("Удалено")
    } catch {
      toast.error("Не удалось удалить")
      setShares(prev)
    }
  }

  if (!open) return null

  const totalSelected = selStudents.size + selHomeworks.size + selGroups.size

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHARE_CSS }} />
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="modal-card share-modal" role="dialog" aria-modal="true">
          <h2>Поделиться</h2>
          <div className="modal-sub" title={materialTitle}>
            {materialTitle}
          </div>

          <div className="share-tabs">
            <button
              className={`share-tab${tab === "students" ? " active" : ""}`}
              onClick={() => setTab("students")}
              type="button"
            >
              Ученики<span className="cnt">{students.length}</span>
            </button>
            <button
              className={`share-tab${tab === "homeworks" ? " active" : ""}`}
              onClick={() => setTab("homeworks")}
              type="button"
            >
              Домашки<span className="cnt">{homeworks.length}</span>
            </button>
            <button
              className={`share-tab${tab === "groups" ? " active" : ""}`}
              onClick={() => setTab("groups")}
              type="button"
            >
              Группы<span className="cnt">{groups.length}</span>
            </button>
          </div>

          <input
            className="share-search"
            placeholder={
              tab === "students"
                ? "Поиск ученика..."
                : tab === "homeworks"
                ? "Поиск домашки..."
                : "Поиск группы..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Students tab */}
          {tab === "students" && (
            <div className="share-list">
              {loadingData ? (
                <div className="share-empty">Загрузка...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="share-empty">Нет учеников</div>
              ) : (
                filteredStudents.map((s) => {
                  const checked = selStudents.has(s.id)
                  return (
                    <div
                      key={s.id}
                      className={`share-item${checked ? " checked" : ""}`}
                      onClick={() => toggle(selStudents, s.id, setSelStudents)}
                    >
                      <div className="chk">
                        <CheckIcon />
                      </div>
                      {s.avatar_url ? (
                        <img className="av" src={s.avatar_url} alt={s.full_name} />
                      ) : (
                        <div className="av">{initialsOf(s.full_name) || "?"}</div>
                      )}
                      <div className="info">
                        <div className="nm">{s.full_name || "Без имени"}</div>
                        {s.english_level ? <div className="sub">Уровень {s.english_level}</div> : null}
                      </div>
                      {s.english_level ? <span className="lvl">{s.english_level}</span> : null}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Homeworks tab */}
          {tab === "homeworks" && (
            <div className="share-list">
              {loadingData ? (
                <div className="share-empty">Загрузка...</div>
              ) : filteredHomeworks.length === 0 ? (
                <div className="share-empty">Нет активных домашних заданий</div>
              ) : (
                filteredHomeworks.map((h) => {
                  const checked = selHomeworks.has(h.id)
                  return (
                    <div
                      key={h.id}
                      className={`share-item${checked ? " checked" : ""}`}
                      onClick={() => toggle(selHomeworks, h.id, setSelHomeworks)}
                    >
                      <div className="chk">
                        <CheckIcon />
                      </div>
                      <div className="info">
                        <div className="nm">{h.title}</div>
                        {h.student_name ? <div className="sub">{h.student_name}</div> : null}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Groups tab */}
          {tab === "groups" && (
            <>
              <div className="share-list">
                {loadingData ? (
                  <div className="share-empty">Загрузка...</div>
                ) : filteredGroups.length === 0 ? (
                  <div className="share-empty">Групп пока нет</div>
                ) : (
                  filteredGroups.map((g) => {
                    const checked = selGroups.has(g.id)
                    return (
                      <div
                        key={g.id}
                        className={`share-item${checked ? " checked" : ""}`}
                        onClick={() => toggle(selGroups, g.id, setSelGroups)}
                      >
                        <div className="chk">
                          <CheckIcon />
                        </div>
                        <div className="info">
                          <div className="nm">{g.name}</div>
                          <div className="sub">
                            {g.member_count} {g.member_count === 1 ? "участник" : g.member_count < 5 ? "участника" : "участников"}
                            {g.description ? ` · ${g.description}` : ""}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {!newGroupOpen ? (
                <button
                  type="button"
                  className="share-create-btn"
                  onClick={() => setNewGroupOpen(true)}
                >
                  + Создать группу
                </button>
              ) : (
                <div className="share-new-group">
                  <h4>Новая группа</h4>
                  <input
                    placeholder="Название (напр. B2 Evening)"
                    value={ngName}
                    onChange={(e) => setNgName(e.target.value)}
                  />
                  <input
                    placeholder="Описание (необязательно)"
                    value={ngDesc}
                    onChange={(e) => setNgDesc(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", margin: "8px 0 6px" }}>
                    Участники
                  </div>
                  <div className="share-list" style={{ maxHeight: 160, marginBottom: 8 }}>
                    {students.length === 0 ? (
                      <div className="share-empty">Нет учеников</div>
                    ) : (
                      students.map((s) => {
                        const checked = ngMembers.has(s.id)
                        return (
                          <div
                            key={s.id}
                            className={`share-item${checked ? " checked" : ""}`}
                            onClick={() => toggle(ngMembers, s.id, setNgMembers)}
                          >
                            <div className="chk">
                              <CheckIcon />
                            </div>
                            {s.avatar_url ? (
                              <img className="av" src={s.avatar_url} alt={s.full_name} />
                            ) : (
                              <div className="av">{initialsOf(s.full_name) || "?"}</div>
                            )}
                            <div className="info">
                              <div className="nm">{s.full_name || "Без имени"}</div>
                              {s.english_level ? <div className="sub">Уровень {s.english_level}</div> : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="sg-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setNewGroupOpen(false)
                        setNgName("")
                        setNgDesc("")
                        setNgMembers(new Set())
                      }}
                      disabled={creatingGroup}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={createGroup}
                      disabled={creatingGroup || !ngName.trim()}
                    >
                      {creatingGroup ? "Создаю..." : "Создать"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Existing shares */}
          {shares.length > 0 && (
            <div className="share-existing">
              <div className="share-existing-title">Уже расшарено ({shares.length})</div>
              <div className="share-existing-list">
                {shares.map((sh) => (
                  <span key={sh.id} className="share-chip">
                    <span className="chip-type">
                      {sh.target_type === "student"
                        ? "Ученик"
                        : sh.target_type === "homework"
                        ? "Домашка"
                        : sh.target_type === "group"
                        ? "Группа"
                        : sh.target_type}
                    </span>
                    {sh.target_name}
                    <button
                      type="button"
                      aria-label="Удалить"
                      title="Удалить"
                      onClick={() => removeShare(sh.id)}
                    >
                      <CloseIcon />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              type="button"
            >
              Закрыть
            </button>
            <button
              className="btn btn-primary"
              onClick={shareNow}
              disabled={saving || totalSelected === 0}
              type="button"
            >
              {saving ? "Отправляю..." : totalSelected > 0 ? `Поделиться (${totalSelected})` : "Поделиться"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
