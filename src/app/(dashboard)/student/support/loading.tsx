// Skeleton для /student/support — раньше 5+ сек белого экрана на мобиле.
import { getTranslations } from "next-intl/server"

export default async function StudentSupportLoading() {
  const t = await getTranslations("dashboard.student.support")
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">{t("loadingLabel")}</span>
      <div className="skeleton-block" style={{ height: 56, maxWidth: 320 }} />
      <div className="skeleton-block" style={{ height: 120 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 72 }} />
        ))}
      </div>
    </div>
  )
}
