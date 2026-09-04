"use client"

// Слушает Realtime UPDATE на lessons, где текущий пользователь = student
// или teacher. Если изменилось scheduled_at или duration_minutes — показывает
// всплывающее уведомление «Время вашего занятия изменилось» (Figma 2505:3378).
//
// Подписка живёт на протяжении сессии дашборда. Не показывает уведомления
// на изменения, инициированные самим пользователем (сравниваем `updated_by`,
// если оно есть; сейчас в схеме такого поля нет, поэтому показываем всем).

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Payload = {
  new: {
    id: string
    scheduled_at: string
    duration_minutes: number
  }
  old: {
    id: string
    scheduled_at?: string | null
    duration_minutes?: number | null
  }
}

export default function LessonRescheduleWatcher({
  userId,
  role,
  scheduleHref,
}: {
  userId: string
  /** Роль текущего пользователя — для фильтра подписки. */
  role: "student" | "teacher"
  /** Куда вести кнопкой «Календарь». По умолчанию #schedule. */
  scheduleHref?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let teacherProfileId: string | null = null
    let cleanupFn: (() => void) | null = null
    let cancelled = false

    async function boot() {
      if (role === "teacher") {
        const { data } = await supabase
          .from("teacher_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle<{ id: string }>()
        teacherProfileId = data?.id ?? null
      }
      if (cancelled) return

      const filter = role === "student"
        ? `student_id=eq.${userId}`
        : teacherProfileId
          ? `teacher_id=eq.${teacherProfileId}`
          : null
      if (!filter) return

      // REPLICA IDENTITY у lessons — PK-only, payload.old содержит только id.
      // Поэтому initial-load текущих активных уроков → кешируем scheduled_at,
      // затем при UPDATE сверяем с кешем.
      const lastSeenAt = new Map<string, string>()
      const refreshCache = async () => {
        try {
          const res = await fetch('/api/lessons?status=booked,in_progress,pending_payment&limit=200', { cache: 'no-store' })
          if (!res.ok) return
          const j = await res.json().catch(() => null) as { lessons?: Array<{ id: string; scheduled_at: string }> } | null
          for (const l of j?.lessons ?? []) {
            const prev = lastSeenAt.get(l.id)
            // При reconnect: если scheduled_at изменился, пока сокет был
            // отключён — покажем нотификацию так же, как для live-UPDATE.
            if (prev && prev !== l.scheduled_at) setOpen(true)
            lastSeenAt.set(l.id, l.scheduled_at)
          }
        } catch { /* ignore */ }
      }
      await refreshCache()

      const channel = supabase
        .channel(`lessons-reschedule-${userId}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "lessons", filter },
          (payload) => {
            const p = payload as unknown as { new: { id: string; scheduled_at: string; duration_minutes: number } }
            const prev = lastSeenAt.get(p.new.id)
            lastSeenAt.set(p.new.id, p.new.scheduled_at)
            if (prev && prev !== p.new.scheduled_at) {
              setOpen(true)
            }
          },
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            // Reconnect-safe: перечитываем снимок, чтобы не пропустить
            // reschedule произошедший во время разрыва.
            void refreshCache()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn("[reschedule-watcher] realtime status:", status, err ?? "")
          }
        })

      cleanupFn = () => { supabase.removeChannel(channel) }
    }

    void boot()
    return () => {
      cancelled = true
      cleanupFn?.()
    }
  }, [userId, role])

  if (!open) return null

  const href = scheduleHref ?? "#schedule"

  return (
    <div className="lesson-resch-overlay" onClick={() => setOpen(false)}>
      <div className="lesson-resch-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lesson-resch-close" aria-label="Закрыть" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="#1E1E1E" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <p className="lesson-resch-text">
          Время вашего занятия<br />изменилось, проверьте<br />календарь
        </p>
        <a href={href} className="lesson-resch-cta" style={{ color: "#fff" }} onClick={() => setOpen(false)}>
          Календарь
        </a>
      </div>
    </div>
  )
}
