// Skeleton для /admin/schedule — страница-заглушка «Скоро»: hero + feat-карточки.
export default function AdminScheduleLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 4,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <span className="sr-only">Загрузка…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

      {/* Hero stub block */}
      <div className="skeleton-block" style={{ height: 280 }} />

      {/* 3 feature cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div className="skeleton-block" style={{ height: 96 }} />
        <div className="skeleton-block" style={{ height: 96 }} />
        <div className="skeleton-block" style={{ height: 96 }} />
      </div>
    </div>
  )
}
