"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Slot = {
  teacherUserId: string | null
  teacherName: string | null
  weekdayLabel: string
  timeLabel: string
  nextIso: string
  duration: number
}

export function PreferredSlotBanner({ slots }: { slots: Slot[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  if (slots.length === 0) return null

  async function rebook(s: Slot) {
    if (!s.teacherUserId) {
      toast.error("Преподаватель не связан с этим слотом")
      return
    }
    setPending(s.nextIso)
    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: s.teacherUserId,
          scheduledAt: s.nextIso,
          durationMinutes: String(s.duration),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Не получилось забронировать")
        setPending(null)
        return
      }
      toast.success(`Записаны: ${s.weekdayLabel}, ${s.timeLabel}`)
      router.refresh()
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background:
          "linear-gradient(135deg, rgba(74,222,128,.10), rgba(230,57,70,.06))",
        border: "1px solid rgba(74,222,128,.25)",
        borderRadius: 14,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: ".5px",
          color: "#16A34A",
        }}
      >
        🔁 Закреплённый слот
      </div>
      {slots.map((s) => {
        const dt = new Date(s.nextIso)
        const dateStr = dt.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          timeZone: "Europe/Moscow",
        })
        return (
          <div
            key={`${s.nextIso}-${s.teacherUserId}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                {s.teacherName ? <>с <b>{s.teacherName}</b> · </> : null}
                {s.weekdayLabel.charAt(0).toUpperCase() + s.weekdayLabel.slice(1)}, {s.timeLabel} МСК
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Следующий повтор — {dateStr}
              </div>
            </div>
            <button
              type="button"
              onClick={() => rebook(s)}
              disabled={pending === s.nextIso}
              style={{
                background: "#E63946",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 0 rgba(180,30,45,.3)",
                opacity: pending === s.nextIso ? 0.6 : 1,
              }}
            >
              {pending === s.nextIso ? "Бронируем…" : "Записаться повторно"}
            </button>
          </div>
        )
      })}
    </div>
  )
}
