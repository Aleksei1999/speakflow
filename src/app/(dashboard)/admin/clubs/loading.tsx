// Skeleton для /admin/clubs — header + фильтры + грид карточек клубов.
export default function AdminClubsLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка клубов…</span>

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
      </div>

      {/* Club cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 200 }} />
        ))}
      </div>
    </div>
  )
}
