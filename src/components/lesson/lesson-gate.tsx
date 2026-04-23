"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { computeLessonAccess, type LessonAccessStatus } from "@/lib/lesson-access"
import { formatLessonDateTimeShort } from "@/lib/time"

interface Props {
  scheduledAt: string
  durationMinutes: number
  status?: string | null
  teacherName?: string
  isTeacher?: boolean
  /**
   * Предварительно вычисленный на сервере статус — чтобы сразу показать нужный экран
   * без «мигания». Клиент всё равно пересчитывает каждую секунду.
   */
  initialStatus?: LessonAccessStatus
}

const CSS = `
.lg-wrap{min-height:calc(100vh - 80px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif}
.lg-card{background:#fff;border:1px solid #EEEEEA;border-radius:20px;padding:36px 32px;max-width:480px;width:100%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.04)}
.lg-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px}
.lg-badge.wait{background:#D8F26A;color:#0A0A0A}
.lg-badge.expired{background:#F5F5F3;color:#8A8A86}
.lg-badge.cancelled{background:#E63946;color:#fff}
.lg-title{font-size:24px;font-weight:800;letter-spacing:-0.5px;margin:0 0 10px}
.lg-sub{font-size:14px;color:#8A8A86;line-height:1.55;margin:0 0 24px}
.lg-sub strong{color:#0A0A0A;font-weight:700}
.lg-timer{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:28px 0}
.lg-timer .slot{background:#0A0A0A;color:#fff;border-radius:14px;padding:16px 4px;display:flex;flex-direction:column;align-items:center;gap:4px}
.lg-timer .slot.soon{background:#E63946}
.lg-timer .num{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-1px;line-height:1}
.lg-timer .lbl{font-size:10px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.lg-soon{font-size:16px;font-weight:700;color:#E63946;margin:24px 0}
.lg-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.lg-btn{padding:11px 22px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:transform .1s ease,background .15s ease}
.lg-btn:active{transform:scale(0.97)}
.lg-btn.primary{background:#0A0A0A;color:#fff}
.lg-btn.primary:hover{background:#E63946}
.lg-btn.ghost{background:#F5F5F3;color:#0A0A0A}
.lg-btn.ghost:hover{background:#EEEEEA}
.lg-meta{font-size:12px;color:#8A8A86;margin-top:14px}
@media(max-width:500px){.lg-card{padding:28px 20px}.lg-title{font-size:20px}.lg-timer .num{font-size:22px}}
`

function computeBreakdown(ms: number) {
  const safe = Math.max(0, ms)
  const total = Math.floor(safe / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { days, hours, minutes, seconds, totalSec: total }
}

export function LessonGate({
  scheduledAt,
  durationMinutes,
  status,
  teacherName,
  isTeacher,
  initialStatus,
}: Props) {
  const router = useRouter()
  const [nowMs, setNowMs] = useState(() => Date.now())

  // tick every second
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const access = useMemo(
    () => computeLessonAccess({ scheduledAt, durationMinutes, status, now: nowMs }),
    [scheduledAt, durationMinutes, status, nowMs]
  )

  // Когда окно открылось — автоматически просим сервер пересчитать и впустить
  useEffect(() => {
    if (initialStatus === "waiting" && access.status === "live") {
      router.refresh()
    }
  }, [access.status, initialStatus, router])

  const scheduledDisplay = formatLessonDateTimeShort(scheduledAt)
  const backHref = isTeacher ? "/teacher/schedule" : "/student/schedule"

  if (access.status === "cancelled") {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lg-wrap">
          <div className="lg-card">
            <div className="lg-badge cancelled">Урок отменён</div>
            <h1 className="lg-title">Этот урок был отменён</h1>
            <p className="lg-sub">
              Вход в комнату невозможен. Если отмена произошла по ошибке — свяжитесь с{" "}
              {isTeacher ? "администратором" : "вашим преподавателем"}.
            </p>
            <div className="lg-actions">
              <button className="lg-btn primary" onClick={() => router.push(backHref)}>
                К расписанию
              </button>
            </div>
            <div className="lg-meta">Запланировано на {scheduledDisplay}</div>
          </div>
        </div>
      </>
    )
  }

  if (access.status === "expired") {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lg-wrap">
          <div className="lg-card">
            <div className="lg-badge expired">Урок завершён</div>
            <h1 className="lg-title">Время урока истекло</h1>
            <p className="lg-sub">
              Комната была доступна до <strong>{formatLessonDateTimeShort(access.closeAtMs)}</strong>.
              Запишитесь на следующий урок в расписании.
            </p>
            <div className="lg-actions">
              <button className="lg-btn primary" onClick={() => router.push(backHref)}>
                К расписанию
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // waiting — обратный отсчёт
  const remainingMs = access.openAtMs - nowMs
  const { days, hours, minutes, seconds, totalSec } = computeBreakdown(remainingMs)
  const soon = totalSec > 0 && totalSec < 30

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lg-wrap">
        <div className="lg-card">
          <div className="lg-badge wait">Ожидание</div>
          <h1 className="lg-title">
            {isTeacher ? "Комната урока" : `Урок с ${teacherName ?? "преподавателем"}`}
          </h1>
          <p className="lg-sub">
            Начало в <strong>{scheduledDisplay}</strong>. Вход откроется за <strong>5 минут</strong> до старта.
          </p>

          {soon ? (
            <div className="lg-soon">Почти готово... подключаем комнату</div>
          ) : (
            <div className="lg-timer" aria-live="polite">
              <div className={`slot ${soon ? "soon" : ""}`}>
                <span className="num">{String(days).padStart(2, "0")}</span>
                <span className="lbl">дней</span>
              </div>
              <div className={`slot ${soon ? "soon" : ""}`}>
                <span className="num">{String(hours).padStart(2, "0")}</span>
                <span className="lbl">часов</span>
              </div>
              <div className={`slot ${soon ? "soon" : ""}`}>
                <span className="num">{String(minutes).padStart(2, "0")}</span>
                <span className="lbl">минут</span>
              </div>
              <div className={`slot ${soon ? "soon" : ""}`}>
                <span className="num">{String(seconds).padStart(2, "0")}</span>
                <span className="lbl">секунд</span>
              </div>
            </div>
          )}

          <div className="lg-actions">
            <button className="lg-btn primary" onClick={() => router.refresh()}>
              Обновить
            </button>
            <button className="lg-btn ghost" onClick={() => router.push(backHref)}>
              К расписанию
            </button>
          </div>
          <div className="lg-meta">Комната откроется в {formatLessonDateTimeShort(access.openAtMs)}</div>
        </div>
      </div>
    </>
  )
}
