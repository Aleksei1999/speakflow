// Skeleton для /student/balance — balance hero (тёмная карточка), Pro/Free сравнение,
// топап-тиры + история транзакций.
export default function StudentBalanceLoading() {
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
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <span className="sr-only">Загрузка баланса…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 56, maxWidth: 320 }} />

      {/* Balance hero */}
      <div className="skeleton-block" style={{ height: 200 }} />

      {/* Topup tiers row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <div className="skeleton-block" style={{ height: 120 }} />
        <div className="skeleton-block" style={{ height: 120 }} />
        <div className="skeleton-block" style={{ height: 120 }} />
        <div className="skeleton-block" style={{ height: 120 }} />
      </div>

      {/* Pro vs Free section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <div className="skeleton-block" style={{ height: 240 }} />
        <div className="skeleton-block" style={{ height: 240 }} />
      </div>

      {/* History list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 56 }} />
        ))}
      </div>
    </div>
  )
}
