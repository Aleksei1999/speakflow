// Skeleton для /admin/teachers — re-export из /teacher/teachers (каталог «Коллеги»):
// фильтры + грид карточек преподавателей.
export default function AdminTeachersLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка преподавателей…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* Filters */}
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
      </div>

      {/* Teacher cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 220 }} />
        ))}
      </div>
    </div>
  )
}
