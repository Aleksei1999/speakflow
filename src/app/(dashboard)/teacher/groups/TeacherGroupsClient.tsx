// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"

type Group = {
  id: string
  name: string
  description: string | null
  member_count: number
  created_at: string
}

type Student = {
  id: string
  full_name: string
  avatar_url: string | null
  english_level: string | null
}

type GroupMember = {
  student_id: string
  full_name: string
  avatar_url: string | null
  english_level: string | null
}

function initialsOf(name: string | null | undefined): string {
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

function pluralMem(n: number) {
  if (n === 1) return "участник"
  if (n >= 2 && n <= 4) return "участника"
  return "участников"
}

export default function TeacherGroupsClient() {
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [apiMissing, setApiMissing] = useState(false)

  // create/edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [mName, setMName] = useState("")
  const [mDesc, setMDesc] = useState("")
  const [mMembers, setMMembers] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailGroup, setDetailGroup] = useState<Group | null>(null)
  const [detailMembers, setDetailMembers] = useState<GroupMember[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const handle401 = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/login"
  }, [])

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/teacher/groups", { cache: "no-store" })
      if (res.status === 401) return handle401()
      if (res.status === 404) {
        setApiMissing(true)
        return
      }
      setApiMissing(false)
      if (!res.ok) throw new Error("HTTP " + res.status)
      const j = await res.json()
      setGroups(Array.isArray(j.groups) ? j.groups : [])
    } catch {
      // keep
    } finally {
      setLoading(false)
    }
  }, [handle401])

  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/students", { cache: "no-store" })
      if (res.status === 401) return handle401()
      if (!res.ok) return
      const j = await res.json()
      setStudents(Array.isArray(j.students) ? j.students : [])
    } catch {}
  }, [handle401])

  useEffect(() => {
    loadGroups()
    loadStudents()
  }, [loadGroups, loadStudents])

  function openCreate() {
    setEditingGroup(null)
    setMName("")
    setMDesc("")
    setMMembers(new Set())
    setModalOpen(true)
  }

  async function openEdit(g: Group) {
    setEditingGroup(g)
    setMName(g.name)
    setMDesc(g.description ?? "")
    setMMembers(new Set())
    setModalOpen(true)
    // Fetch current members
    try {
      const r = await fetch(`/api/teacher/groups/${encodeURIComponent(g.id)}`, { cache: "no-store" })
      if (r.status === 401) return handle401()
      if (!r.ok) return
      const j = await r.json()
      const ids = new Set<string>((j.members ?? []).map((m: GroupMember) => m.student_id))
      setMMembers(ids)
    } catch {}
  }

  function toggleMember(id: string) {
    const next = new Set(mMembers)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setMMembers(next)
  }

  async function saveGroup() {
    if (!mName.trim()) {
      toast.error("Введи название группы")
      return
    }
    setSaving(true)
    try {
      if (editingGroup) {
        // PATCH name/description
        const res = await fetch(`/api/teacher/groups/${encodeURIComponent(editingGroup.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: mName.trim(),
            description: mDesc.trim() || null,
          }),
        })
        if (res.status === 401) return handle401()
        if (!res.ok) {
          toast.error("Не удалось сохранить")
          return
        }
        // Sync members (replace): fetch current, diff, add/remove
        try {
          const cur = await fetch(`/api/teacher/groups/${encodeURIComponent(editingGroup.id)}`, { cache: "no-store" })
          const cj = cur.ok ? await cur.json() : { members: [] }
          const currentIds = new Set<string>((cj.members ?? []).map((m: GroupMember) => m.student_id))
          const toAdd: string[] = []
          const toRemove: string[] = []
          for (const id of mMembers) if (!currentIds.has(id)) toAdd.push(id)
          for (const id of currentIds) if (!mMembers.has(id)) toRemove.push(id)
          if (toAdd.length > 0) {
            await fetch(`/api/teacher/groups/${encodeURIComponent(editingGroup.id)}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ student_ids: toAdd }),
            })
          }
          for (const rid of toRemove) {
            await fetch(`/api/teacher/groups/${encodeURIComponent(editingGroup.id)}/members?student_id=${encodeURIComponent(rid)}`, {
              method: "DELETE",
            })
          }
        } catch {}
        toast.success("Группа обновлена")
      } else {
        const res = await fetch("/api/teacher/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: mName.trim(),
            description: mDesc.trim() || undefined,
            student_ids: Array.from(mMembers),
          }),
        })
        if (res.status === 401) return handle401()
        if (!res.ok) {
          toast.error("Не удалось создать группу")
          return
        }
        toast.success("Группа создана")
      }
      setModalOpen(false)
      loadGroups()
    } catch {
      toast.error("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  async function deleteGroup(g: Group) {
    if (typeof window === "undefined" || !window.confirm(`Удалить группу «${g.name}»?`)) return
    // optimistic
    const prev = groups
    setGroups((s) => s.filter((x) => x.id !== g.id))
    try {
      const res = await fetch(`/api/teacher/groups/${encodeURIComponent(g.id)}`, { method: "DELETE" })
      if (res.status === 401) return handle401()
      if (!res.ok) throw new Error("failed")
      toast.success("Группа удалена")
    } catch {
      toast.error("Не удалось удалить")
      setGroups(prev)
    }
  }

  async function openDetail(g: Group) {
    setDetailGroup(g)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailMembers([])
    try {
      const r = await fetch(`/api/teacher/groups/${encodeURIComponent(g.id)}`, { cache: "no-store" })
      if (r.status === 401) return handle401()
      if (!r.ok) return
      const j = await r.json()
      setDetailMembers(Array.isArray(j.members) ? j.members : [])
    } catch {} finally {
      setDetailLoading(false)
    }
  }

  async function removeMemberFromDetail(studentId: string) {
    if (!detailGroup) return
    const prev = detailMembers
    setDetailMembers((s) => s.filter((m) => m.student_id !== studentId))
    try {
      const r = await fetch(
        `/api/teacher/groups/${encodeURIComponent(detailGroup.id)}/members?student_id=${encodeURIComponent(studentId)}`,
        { method: "DELETE" }
      )
      if (r.status === 401) return handle401()
      if (!r.ok) throw new Error("failed")
      toast.success("Удалён из группы")
      // refresh list count
      loadGroups()
    } catch {
      toast.error("Не удалось удалить")
      setDetailMembers(prev)
    }
  }

  const notInGroup = useMemo(() => {
    if (!detailGroup) return []
    const existing = new Set(detailMembers.map((m) => m.student_id))
    return students.filter((s) => !existing.has(s.id))
  }, [students, detailMembers, detailGroup])

  async function addMemberToDetail(studentId: string) {
    if (!detailGroup) return
    try {
      const r = await fetch(`/api/teacher/groups/${encodeURIComponent(detailGroup.id)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [studentId] }),
      })
      if (r.status === 401) return handle401()
      if (!r.ok) throw new Error("failed")
      const added = students.find((s) => s.id === studentId)
      if (added) {
        setDetailMembers((prev) => [
          ...prev,
          {
            student_id: added.id,
            full_name: added.full_name,
            avatar_url: added.avatar_url,
            english_level: added.english_level,
          },
        ])
      }
      toast.success("Добавлен в группу")
      loadGroups()
    } catch {
      toast.error("Не удалось добавить")
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={openCreate} type="button">
          + Создать группу
        </button>
      </div>

      <div className="g-card">
        {apiMissing ? (
          <div className="g-empty">
            <b>API подготавливается</b>
            Эндпоинт /api/teacher/groups ещё не задеплоен — обнови страницу через минуту.
          </div>
        ) : loading ? (
          <div className="g-empty">Загрузка...</div>
        ) : groups.length === 0 ? (
          <div className="g-empty">
            <b>Групп пока нет</b>
            Создай первую группу, чтобы удобно делиться материалами сразу с несколькими учениками.
          </div>
        ) : (
          <table className="g-tbl">
            <thead>
              <tr>
                <th>Название</th>
                <th>Участники</th>
                <th>Создана</th>
                <th style={{ textAlign: "right" }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="clickable"
                  onClick={() => openDetail(g)}
                >
                  <td>
                    <div className="g-name">{g.name}</div>
                    {g.description ? <div className="g-desc">{g.description}</div> : null}
                  </td>
                  <td>
                    <span className="g-count">
                      {g.member_count} {pluralMem(g.member_count)}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>
                    {g.created_at ? format(new Date(g.created_at), "d MMM yyyy", { locale: ru }) : "—"}
                  </td>
                  <td>
                    <div className="g-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(g)
                        }}
                        type="button"
                      >
                        Редактировать
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteGroup(g)
                        }}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>{editingGroup ? "Редактировать группу" : "Новая группа"}</h2>
            <div className="modal-sub">
              {editingGroup ? "Обнови название и состав" : "Задай название и выбери участников"}
            </div>

            <div className="field">
              <label>Название</label>
              <input
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Напр. B2 Morning"
              />
            </div>

            <div className="field">
              <label>Описание</label>
              <textarea
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                placeholder="Короткая заметка для себя"
              />
            </div>

            <div className="field">
              <label>Участники ({mMembers.size})</label>
              <div className="mem-list">
                {students.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                    Нет учеников
                  </div>
                ) : (
                  students.map((s) => {
                    const checked = mMembers.has(s.id)
                    return (
                      <div
                        key={s.id}
                        className={`mem-item${checked ? " checked" : ""}`}
                        onClick={() => toggleMember(s.id)}
                      >
                        <div className="chk">
                          <CheckIcon />
                        </div>
                        {s.avatar_url ? (
                          <img className="av" src={s.avatar_url} alt={s.full_name} />
                        ) : (
                          <div className="av">{initialsOf(s.full_name) || "?"}</div>
                        )}
                        <div className="nm">{s.full_name || "Без имени"}</div>
                        {s.english_level ? <span className="lvl">{s.english_level}</span> : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                type="button"
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={saveGroup}
                disabled={saving || !mName.trim()}
                type="button"
              >
                {saving ? "Сохраняю..." : editingGroup ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailOpen && detailGroup && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailOpen(false) }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>{detailGroup.name}</h2>
            <div className="modal-sub">
              {detailGroup.description || "Участники группы"}
            </div>

            <div className="field">
              <label>Участники ({detailMembers.length})</label>
              <div className="mem-list">
                {detailLoading ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                    Загрузка...
                  </div>
                ) : detailMembers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                    Пока никого нет
                  </div>
                ) : (
                  detailMembers.map((m) => (
                    <div key={m.student_id} className="mem-item">
                      {m.avatar_url ? (
                        <img className="av" src={m.avatar_url} alt={m.full_name} />
                      ) : (
                        <div className="av">{initialsOf(m.full_name) || "?"}</div>
                      )}
                      <div className="nm">{m.full_name}</div>
                      {m.english_level ? <span className="lvl">{m.english_level}</span> : null}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeMemberFromDetail(m.student_id)}
                        type="button"
                        style={{ marginLeft: 8 }}
                      >
                        Убрать
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {notInGroup.length > 0 && (
              <div className="field">
                <label>Добавить</label>
                <div className="mem-list" style={{ maxHeight: 160 }}>
                  {notInGroup.map((s) => (
                    <div key={s.id} className="mem-item" onClick={() => addMemberToDetail(s.id)}>
                      {s.avatar_url ? (
                        <img className="av" src={s.avatar_url} alt={s.full_name} />
                      ) : (
                        <div className="av">{initialsOf(s.full_name) || "?"}</div>
                      )}
                      <div className="nm">{s.full_name}</div>
                      {s.english_level ? <span className="lvl">{s.english_level}</span> : null}
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>+</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDetailOpen(false)}
                type="button"
              >
                Закрыть
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setDetailOpen(false)
                  openEdit(detailGroup)
                }}
                type="button"
              >
                Редактировать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
