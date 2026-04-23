"use client"

import Link from "next/link"

type Props = {
  clubsThisWeek: number
  newMaterials: number
  referralActivated?: number
  referralCapRemaining?: number
}

export function QuickActions({
  clubsThisWeek,
  newMaterials,
  referralActivated,
  referralCapRemaining,
}: Props) {
  // Формируем текст карточки «Пригласить друга».
  // Если API-данные пришли — показываем «N/10 активировано · +100 XP».
  // Иначе — graceful fallback на "0/10 активировано".
  const activated = typeof referralActivated === "number" ? referralActivated : 0
  const capMax =
    typeof referralCapRemaining === "number"
      ? activated + referralCapRemaining
      : 10
  const refSub = `${activated}/${capMax} активировано · +100 XP`

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
      <Link href="/student/referrals" className="quick-card">
        <div className="qc-icon">👥</div>
        <div className="qc-text">Пригласить друга</div>
        <div className="qc-sub">{refSub}</div>
      </Link>
    </div>
  )
}
