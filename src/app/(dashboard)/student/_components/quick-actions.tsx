"use client"

import Link from "next/link"
import { useState } from "react"
import { BookingDrawer } from "@/components/booking/booking-drawer"

type Props = {
  clubsThisWeek: number
  newMaterials: number
}

export function QuickActions({ clubsThisWeek, newMaterials }: Props) {
  const [bookingOpen, setBookingOpen] = useState(false)

  return (
    <>
      <div className="quick-grid">
        <Link href="/student/schedule" className="quick-card quick-card--cta">
          <div className="qc-icon">🎙</div>
          <div className="qc-text">Speaking Club</div>
          <div className="qc-sub">{clubsThisWeek > 0 ? `${clubsThisWeek} клуб${clubsThisWeek === 1 ? "" : clubsThisWeek < 5 ? "а" : "ов"} на этой неделе` : "Расписание клубов"}</div>
        </Link>
        <Link href="/student/materials" className="quick-card">
          <div className="qc-icon">📚</div>
          <div className="qc-text">Материалы</div>
          <div className="qc-sub">{newMaterials > 0 ? `${newMaterials} новых` : "Все уроки"}</div>
        </Link>
        <button type="button" className="quick-card" onClick={() => setBookingOpen(true)}>
          <div className="qc-icon">⚡</div>
          <div className="qc-text">Записаться</div>
          <div className="qc-sub">1-on-1 урок</div>
        </button>
        <Link href="/teachers" className="quick-card">
          <div className="qc-icon">🎟</div>
          <div className="qc-text">Преподаватели</div>
          <div className="qc-sub">Выбор ментора</div>
        </Link>
      </div>
      <BookingDrawer open={bookingOpen} onOpenChange={setBookingOpen} />
    </>
  )
}
