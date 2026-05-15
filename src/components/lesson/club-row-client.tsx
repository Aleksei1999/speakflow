"use client"

// ---------------------------------------------------------------
// ClubRowClient — client-row для Speaking Club строки на teacher
// dashboard. Аналог LessonRowClient, но визуал/href/CTA-метки отличаются:
//   • href = /club/{id}/room (не /teacher/lesson/{id})
//   • заголовок: «🎙 {topic}»
//   • subтитул: «Speaking Club · seats_taken/capacity участников»
//   • default-CTA (вне SOON) = серый pill «ожидается»
//   • liveLabel = «🎙 Зайти»
//
// Зачем: до этого clickable / .active / CTA-условия club-row шли server-side
// (computeLessonAccess(now=new Date())), и из-за этого teacher/page.tsx
// застрял на force-dynamic. Этот компонент тикает Date.now() сам.
// ---------------------------------------------------------------

import { useState, useEffect } from "react"
import Link from "next/link"
import { computeLessonAccess } from "@/lib/lesson-access"
import { LiveLessonCTA } from "./live-lesson-cta"
import { formatLessonTime } from "@/lib/time"

// 30s tick — см. lesson-row-client/live-lesson-cta.
const TICK_MS = 30000
const SOON_WINDOW_SEC = 600

export interface ClubRowClientProps {
  clubId: string
  startsAt: string
  durationMin: number
  topic: string
  seatsTaken: number
  capacity: number
}

export function ClubRowClient({
  clubId,
  startsAt,
  durationMin,
  topic,
  seatsTaken,
  capacity,
}: ClubRowClientProps): React.ReactNode {
  // Hydration-safe: 0 на SSR → стабильный fallback. После mount —
  // реальный Date.now() + tick. Защищает от React #418.
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const at = new Date(startsAt)
  const access = computeLessonAccess({
    scheduledAt: startsAt,
    durationMinutes: durationMin,
    now,
  })
  const secondsUntilOpen = Math.max(
    0,
    Math.floor((access.openAtMs - access.nowMs) / 1000),
  )
  const isLive = access.status === "live"
  const isSoon = access.status === "waiting" && secondsUntilOpen <= SOON_WINDOW_SEC

  // CTA: live / soon / expired → client countdown через LiveLessonCTA,
  //      default («ожидается, > 10 мин до openAt») → серый pill.
  let cta: React.ReactNode
  if (isLive || isSoon || access.status === "expired") {
    cta = (
      <LiveLessonCTA
        lessonId={clubId}
        scheduledAt={startsAt}
        durationMinutes={durationMin}
        role="club"
        classPrefix="tch-today-join"
        hintClassName="tch-today-hint"
        liveLabel="🎙 Зайти"
      />
    )
  } else {
    cta = <span className="status status-pending">ожидается</span>
  }

  const clickable = isLive || isSoon
  const href = `/club/${clubId}/room`
  const inner = (
    <>
      <div className="schedule-time">
        <div className="time">{formatLessonTime(at)}</div>
        <div className="dur">{durationMin} мин</div>
      </div>
      <div className="schedule-info">
        <h4>🎙 {topic}</h4>
        <p>Speaking Club · {seatsTaken}/{capacity || seatsTaken} участников</p>
      </div>
      {cta}
    </>
  )

  return clickable ? (
    <Link
      href={href}
      className={`schedule-link schedule-item${isLive ? " active" : ""}`}
    >
      {inner}
    </Link>
  ) : (
    <div className="schedule-item">{inner}</div>
  )
}
