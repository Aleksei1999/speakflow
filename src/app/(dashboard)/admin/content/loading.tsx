// Skeleton для /admin/content — табы (Achievements / Level test / Settings)
// + список достижений с XP, поэтому имитируем header + tabs row + список.
export default function AdminContentLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка контента…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* Tabs row */}
      <div style={{ display: "flex", gap: 8 }}>
        <div className="skeleton-block" style={{ height: 40, width: 140 }} />
        <div className="skeleton-block" style={{ height: 40, width: 140 }} />
        <div className="skeleton-block" style={{ height: 40, width: 140 }} />
      </div>

      {/* List of editable items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 88 }} />
        ))}
      </div>
    </div>
  )
}
