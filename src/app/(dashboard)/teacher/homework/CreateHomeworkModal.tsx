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

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type Attachment = {
  name: string
  url: string
  size?: number
  mime?: string
}

function todayLocalYMD(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function CreateHomeworkModal({ open, onClose, onCreated }: Props) {
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [studentId, setStudentId] = useState<string>("")
  const [studentSearch, setStudentSearch] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState(todayLocalYMD(7))
  const [dueTime, setDueTime] = useState("18:00")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachName, setAttachName] = useState("")
  const [attachUrl, setAttachUrl] = useState("")

  const [saving, setSaving] = useState(false)

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const r = await fetch("/api/teacher/students", { cache: "no-store" })
      if (r.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (r.ok) {
        const j = await r.json()
        setStudents(Array.isArray(j.students) ? j.students : [])
      } else {
        setStudents([])
      }
    } catch {
      setStudents([])
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setStudentId("")
      setStudentSearch("")
      setTitle("")
      setDescription("")
      setDueDate(todayLocalYMD(7))
      setDueTime("18:00")
      setAttachments([])
      setAttachName("")
      setAttachUrl("")
      loadStudents()
    }
  }, [open, loadStudents])

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
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => (s.full_name || "").toLowerCase().includes(q))
  }, [students, studentSearch])

  function addAttachment() {
    const name = attachName.trim()
    const url = attachUrl.trim()
    if (!name || !url) {
      toast.error("Укажи название и ссылку")
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Ссылка должна начинаться с http:// или https://")
      return
    }
    setAttachments((prev) => [...prev, { name, url }])
    setAttachName("")
    setAttachUrl("")
  }

  function removeAttachment(i: number) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!studentId) {
      toast.error("Выбери ученика")
      return
    }
    if (!title.trim()) {
      toast.error("Укажи тему задания")
      return
    }
    if (!dueDate) {
      toast.error("Укажи дедлайн")
      return
    }
    // Compose ISO timestamp from date + time (local)
    const iso = new Date(`${dueDate}T${dueTime || "18:00"}:00`).toISOString()
    setSaving(true)
    try {
      const res = await fetch("/api/teacher/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          title: title.trim(),
          description: description.trim() || null,
          due_date: iso,
          attachments,
        }),
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось создать задание")
        return
      }
      toast.success("Задание выдано")
      onCreated()
    } catch {
      toast.error("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <h2>Новое домашнее задание</h2>
        <div className="modal-sub">Выдай задание одному из своих учеников.</div>

        <div className="field">
          <label>Ученик</label>
          <input
            placeholder="Поиск ученика..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">— выбери ученика —</option>
            {loadingStudents ? (
              <option disabled>Загрузка...</option>
            ) : filteredStudents.length === 0 ? (
              <option disabled>Нет учеников</option>
            ) : (
              filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || "Без имени"}
                  {s.english_level ? ` · ${s.english_level}` : ""}
                </option>
              ))
            )}
          </select>
          <div className="hint">Можно задавать ДЗ ученикам, с которыми уже был хотя бы один урок.</div>
        </div>

        <div className="field">
          <label>Тема задания</label>
          <input
            placeholder="Past Perfect: 20 предложений + перевод текста"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        <div className="field">
          <label>Описание / инструкция</label>
          <textarea
            placeholder="Краткие инструкции, ссылки на материалы, требования к формату..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Дедлайн — дата</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={todayLocalYMD(0)}
            />
          </div>
          <div className="field">
            <label>Дедлайн — время</label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Вложения (ссылки)</label>
          <div className="field-row">
            <input
              placeholder="Название файла (homework.pdf)"
              value={attachName}
              onChange={(e) => setAttachName(e.target.value)}
            />
            <input
              placeholder="https://..."
              value={attachUrl}
              onChange={(e) => setAttachUrl(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addAttachment}
              disabled={!attachName.trim() || !attachUrl.trim()}
            >
              + Добавить вложение
            </button>
          </div>
          {attachments.length > 0 ? (
            <div className="attach-list">
              {attachments.map((a, i) => (
                <div key={i} className="attach-row">
                  <span className="nm" title={a.url}>{a.name}</span>
                  <button
                    type="button"
                    className="rm"
                    onClick={() => removeAttachment(i)}
                    aria-label="Удалить"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="hint">
            Ссылки на материалы из Materials или любые внешние файлы. Загрузка файлов появится позже.
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={saving || !studentId || !title.trim()}
          >
            {saving ? "Создаю..." : "Выдать задание"}
          </button>
        </div>
      </div>
    </div>
  )
}
