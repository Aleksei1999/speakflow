"use client"

import Link from "next/link"

type Props = {
  clubsThisWeek: number
  newMaterials: number
}

export function QuickActions({ clubsThisWeek, newMaterials }: Props) {
  return (
    <div className="quick-grid">
      <Link href="/student/clubs" className="quick-card quick-card--cta">
        <div className="qc-icon">🎙</div>
        <div className="qc-text">Speaking Club</div>
        <div className="qc-sub">{clubsThisWeek > 0 ? `${clubsThisWeek} клуб${clubsThisWeek === 1 ? "" : clubsThisWeek < 5 ? "а" : "ов"} на этой неделе` : "Расписание клубов"}</div>
      </Link>
      <Link href="/student/materials" className="quick-card">
        <div className="qc-icon">📚</div>
        <div className="qc-text">Материалы</div>
        <div className="qc-sub">{newMaterials > 0 ? `${newMaterials} новых урока` : "Все уроки"}</div>
      </Link>
      <Link href="/student/achievements" className="quick-card">
        <div className="qc-icon">⚡</div>
        <div className="qc-text">Daily Challenge</div>
        <div className="qc-sub">+15 XP</div>
      </Link>
      <Link href="/student/leaderboard" className="quick-card">
        <div className="qc-icon">🎟</div>
        <div className="qc-text">Guest Pass</div>
        <div className="qc-sub">Пригласи друга</div>
      </Link>
    </div>
  )
}
