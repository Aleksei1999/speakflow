// Skeleton для /admin/students — таблица учеников с avatar/email/level/XP/streak/lessons.
// Имитируем header + filter row + 8 широких строк таблицы.
export default function AdminStudentsLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка учеников…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* Filter / search row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div className="skeleton-block" style={{ height: 44 }} />
        <div className="skeleton-block" style={{ height: 44 }} />
        <div className="skeleton-block" style={{ height: 44 }} />
        <div className="skeleton-block" style={{ height: 44 }} />
      </div>

      {/* Table rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 64 }} />
        ))}
      </div>
    </div>
  )
}
