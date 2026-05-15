// Skeleton для /admin/settings — re-export со страницы /student/settings,
// поэтому повторяем shape: список секций (профиль / уведомления / приватность / др.).
export default function AdminSettingsLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка настроек…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* Settings sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 140 }} />
        ))}
      </div>
    </div>
  )
}
