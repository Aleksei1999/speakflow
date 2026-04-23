// @ts-nocheck
"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

type Attachment = { name: string; url: string; size?: number; mime?: string }

type Homework = {
  id: string
  student_id: string
  teacher_id: string
  lesson_id: string | null
  title: string
  description: string | null
  due_date: string
  status: string
  submission_text: string | null
  teacher_feedback: string | null
  grade: number | null
  score_10: number | null
  submitted_at: string | null
  reviewed_at: string | null
  reminders_count: number
  attachments: Attachment[]
  created_at: string
  student?: {
    id: string
    full_name: string
    avatar_url: string | null
    email: string | null
    english_level: string | null
  } | null
  lesson?: { id: string; scheduled_at: string } | null
}

type Props = {
  homeworkId: string
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

const SCORE_PRESETS = [10, 9, 8.5, 8, 7, 6, 5]

export default function ReviewHomeworkModal({ homeworkId, open, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hw, setHw] = useState<Homework | null>(null)

  const [feedback, setFeedback] = useState("")
  const [score, setScore] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/teacher/homework/${homeworkId}`, {
        cache: "no-store",
      })
      if (r.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось загрузить задание")
        onClose()
        return
      }
      const j = await r.json()
      const item: Homework = j.homework
      setHw(item)
      setFeedback(item.teacher_feedback || "")
      setScore(
        item.score_10 !== null && item.score_10 !== undefined
          ? String(item.score_10)
          : ""
      )
    } catch {
      toast.error("Сетевая ошибка")
      onClose()
    } finally {
      setLoading(false)
    }
  }, [homeworkId, onClose])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function saveReview() {
    if (!hw) return
    const s = score.replace(",", ".").trim()
    const scoreNum = s === "" ? null : Number(s)
    if (scoreNum !== null && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10)) {
      toast.error("Оценка должна быть от 0 до 10")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/homework/${hw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          teacher_feedback: feedback.trim() || null,
          score_10: scoreNum,
        }),
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось сохранить проверку")
        return
      }
      toast.success("Задание проверено")
      onUpdated()
    } catch {
      toast.error("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  async function sendReminder() {
    if (!hw) return
    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/homework/${hw.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remind" }),
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || "Не удалось отправить напоминание")
        return
      }
      toast.success("Напоминание отправлено")
      onUpdated()
    } catch {
      toast.error("Сетевая ошибка")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const isSubmitted = hw?.status === "submitted"
  const isReviewed = hw?.status === "reviewed"
  const canRemind = hw && !isSubmitted && !isReviewed

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card wide" role="dialog" aria-modal="true">
        {loading || !hw ? (
          <>
            <h2>Загрузка...</h2>
            <div className="modal-sub">Подготавливаем задание</div>
          </>
        ) : (
          <>
            <h2>{hw.title}</h2>
            <div className="modal-sub">
              {hw.student?.full_name || "Ученик"}
              {hw.student?.english_level ? ` · ${hw.student.english_level}` : ""}
              {" · выдано "}
              {format(new Date(hw.created_at), "d MMMM yyyy", { locale: ru })}
            </div>

            {hw.description ? (
              <div className="field">
                <label>Задание</label>
                <div className="submission-box">{hw.description}</div>
              </div>
            ) : null}

            {hw.attachments && hw.attachments.length > 0 ? (
              <div className="field">
                <label>Вложения преподавателя</label>
                <div className="attach-list">
                  {hw.attachments.map((a, i) => (
                    <div key={i} className="attach-row">
                      <span className="nm" title={a.url}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "inherit", textDecoration: "underline" }}
                        >
                          {a.name}
                        </a>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field">
              <label>Дедлайн</label>
              <div className="submission-box" style={{ fontSize: 13 }}>
                {format(new Date(hw.due_date), "d MMMM yyyy, HH:mm", { locale: ru })}
                {hw.reminders_count > 0 ? ` · напоминаний: ${hw.reminders_count}` : ""}
              </div>
            </div>

            {hw.submission_text ? (
              <div className="field">
                <label>
                  Ответ ученика
                  {hw.submitted_at
                    ? ` · сдано ${format(new Date(hw.submitted_at), "d MMMM, HH:mm", { locale: ru })}`
                    : ""}
                </label>
                <div className="submission-box">{hw.submission_text}</div>
              </div>
            ) : isSubmitted ? (
              <div className="field">
                <label>Ответ ученика</label>
                <div className="submission-box" style={{ color: "var(--muted)" }}>
                  Ответ сдан без текста (возможно, только вложения).
                </div>
              </div>
            ) : null}

            {(isSubmitted || isReviewed) ? (
              <>
                <div className="field">
                  <label>Оценка (0–10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="Например, 8.5"
                  />
                  <div className="score-presets">
                    {SCORE_PRESETS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={Number(score) === s ? "active" : ""}
                        onClick={() => setScore(String(s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Фидбэк ученику</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Что получилось хорошо, что исправить, на что обратить внимание..."
                    maxLength={4000}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <div className="submission-box" style={{ color: "var(--muted)" }}>
                  Ученик ещё не сдал работу. Ты можешь отправить напоминание или вернуться позже.
                </div>
              </div>
            )}

            <div className="modal-actions">
              {canRemind ? (
                <button
                  type="button"
                  className="btn btn-secondary left"
                  onClick={sendReminder}
                  disabled={saving}
                >
                  Напомнить ученику
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Закрыть
              </button>
              {(isSubmitted || isReviewed) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveReview}
                  disabled={saving}
                >
                  {saving
                    ? "Сохраняю..."
                    : isReviewed
                    ? "Обновить проверку"
                    : "Сохранить проверку"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
