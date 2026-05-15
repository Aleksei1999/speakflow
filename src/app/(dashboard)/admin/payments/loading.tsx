// Skeleton для /admin/payments — 4 stats-карточки + фильтры + таблица платежей.
export default function AdminPaymentsLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка платежей…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* 4 stats cards (выручка / средний чек / комиссия / возвраты) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <div className="skeleton-block" style={{ height: 100 }} />
        <div className="skeleton-block" style={{ height: 100 }} />
        <div className="skeleton-block" style={{ height: 100 }} />
        <div className="skeleton-block" style={{ height: 100 }} />
      </div>

      {/* Filter row */}
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
          <div key={i} className="skeleton-block" style={{ height: 56 }} />
        ))}
      </div>
    </div>
  )
}
