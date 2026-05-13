// Skeleton для /student/support — раньше 5+ сек белого экрана на мобиле.
export default function StudentSupportLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка обращений…</span>
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
