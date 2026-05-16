"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("dashboard.student.home.quickActions")

  const activated = typeof referralActivated === "number" ? referralActivated : 0
  const capMax =
    typeof referralCapRemaining === "number"
      ? activated + referralCapRemaining
      : 10
  const refSub = t("referralSub", { activated, capMax })

  // Куда вести «Speaking Club» — выбираем подзаголовок: либо счётчик клубов на неделе,
  // либо обобщённый «Расписание клубов».
  const clubSub =
    clubsThisWeek > 0
      ? t("clubsWeek", { count: clubsThisWeek })
      : t("clubsSchedule")

  const materialsSub =
    newMaterials > 0
      ? t("materialsNew", { count: newMaterials })
      : t("materialsAll")

  return (
    <div className="quick-grid">
      <Link href="/student/clubs" className="quick-card quick-card--cta">
        <div className="qc-icon">🎙</div>
        <div className="qc-text">{t("speakingClub")}</div>
        <div className="qc-sub">{clubSub}</div>
      </Link>
      <Link href="/student/materials" className="quick-card">
        <div className="qc-icon">📚</div>
        <div className="qc-text">{t("materials")}</div>
        <div className="qc-sub">{materialsSub}</div>
      </Link>
      <Link href="/student/achievements" className="quick-card">
        <div className="qc-icon">⚡</div>
        <div className="qc-text">{t("dailyChallenge")}</div>
        <div className="qc-sub">{t("dailyChallengeSub")}</div>
      </Link>
      <Link href="/student/referrals" className="quick-card">
        <div className="qc-icon">👥</div>
        <div className="qc-text">{t("inviteFriend")}</div>
        <div className="qc-sub">{refSub}</div>
      </Link>
    </div>
  )
}
