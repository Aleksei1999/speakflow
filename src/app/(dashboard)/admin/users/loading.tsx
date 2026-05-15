// Skeleton для /admin/users — таблица пользователей (avatar/email/role/created_at).
export default function AdminUsersLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка пользователей…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 64 }} />

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
