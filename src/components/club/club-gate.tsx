"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  computeLessonAccess,
  type LessonAccessStatus,
} from "@/lib/lesson-access"
import { formatLessonDateTimeShort } from "@/lib/time"

interface Props {
  scheduledAt: string
  durationMinutes: number
  title: string
  initialStatus: LessonAccessStatus
  backHref: string
  cancelled?: boolean
}

const CSS = `
.cg-wrap{min-height:calc(100vh - 80px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif}
.cg-card{background:#fff;border:1px solid #EEEEEA;border-radius:20px;padding:36px 32px;max-width:480px;width:100%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.04)}
.cg-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px}
.cg-badge.wait{background:#D8F26A;color:#0A0A0A}
.cg-badge.expired{background:#F5F5F3;color:#8A8A86}
.cg-badge.cancelled{background:#E63946;color:#fff}
.cg-title{font-size:24px;font-weight:800;letter-spacing:-.5px;margin:0 0 10px}
.cg-sub{font-size:14px;color:#8A8A86;line-height:1.55;margin:0 0 24px}
.cg-sub strong{color:#0A0A0A;font-weight:700}
.cg-timer{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:28px 0}
.cg-timer .slot{background:#0A0A0A;color:#fff;border-radius:14px;padding:16px 4px;display:flex;flex-direction:column;align-items:center;gap:4px}
.cg-timer .slot.soon{background:#E63946}
.cg-timer .num{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-1px;line-height:1}
.cg-timer .lbl{font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.cg-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.cg-btn{padding:11px 22px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:inherit}
.cg-btn.primary{background:#0A0A0A;color:#fff}
.cg-btn.ghost{background:transparent;color:#0A0A0A;border:1px solid #EEEEEA}
`

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0")
}

export function ClubGate({
  scheduledAt,
  durationMinutes,
  title,
  initialStatus,
  backHref,
  cancelled,
}: Props) {
  const router = useRouter()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const access = useMemo(
    () =>
      computeLessonAccess({
        scheduledAt,
        durationMinutes,
        status: cancelled ? "cancelled" : null,
      }),
    [scheduledAt, durationMinutes, cancelled, tick]
  )

  // If access flips to live while user stays on this page, refresh.
  useEffect(() => {
    if (access.status === "live") {
      router.refresh()
    }
  }, [access.status, router])

  const status: LessonAccessStatus = access.status

  if (status === "cancelled") {
    return (
      <div className="cg-wrap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="cg-card">
          <div className="cg-badge cancelled">Отменён</div>
          <h1 className="cg-title">Клуб отменён</h1>
          <p className="cg-sub">
            Этот Speaking Club был отменён организатором.
          </p>
          <div className="cg-actions">
            <button className="cg-btn primary" onClick={() => router.push(backHref)}>
              Назад
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === "expired") {
    return (
      <div className="cg-wrap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="cg-card">
          <div className="cg-badge expired">Завершён</div>
          <h1 className="cg-title">Клуб уже прошёл</h1>
          <p className="cg-sub">
            «{title}» состоялся{" "}
            <strong>{formatLessonDateTimeShort(scheduledAt)}</strong>.
          </p>
          <div className="cg-actions">
            <button className="cg-btn primary" onClick={() => router.push(backHref)}>
              К списку клубов
            </button>
          </div>
        </div>
      </div>
    )
  }

  // waiting
  const diffMs = Math.max(0, access.openAtMs - access.nowMs)
  const totalSec = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const soon = totalSec <= 60 * 5

  return (
    <div className="cg-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cg-card">
        <div className="cg-badge wait">Скоро</div>
        <h1 className="cg-title">{title}</h1>
        <p className="cg-sub">
          Старт{" "}
          <strong>{formatLessonDateTimeShort(scheduledAt)}</strong>. Вход в
          комнату откроется за 5 минут до начала.
        </p>
        <div className="cg-timer">
          <div className={`slot${soon ? " soon" : ""}`}>
            <div className="num">{pad(days)}</div>
            <div className="lbl">дни</div>
          </div>
          <div className={`slot${soon ? " soon" : ""}`}>
            <div className="num">{pad(hours)}</div>
            <div className="lbl">часы</div>
          </div>
          <div className={`slot${soon ? " soon" : ""}`}>
            <div className="num">{pad(minutes)}</div>
            <div className="lbl">мин</div>
          </div>
          <div className={`slot${soon ? " soon" : ""}`}>
            <div className="num">{pad(seconds)}</div>
            <div className="lbl">сек</div>
          </div>
        </div>
        <div className="cg-actions">
          <button className="cg-btn ghost" onClick={() => router.push(backHref)}>
            Назад
          </button>
        </div>
      </div>
    </div>
  )
}
