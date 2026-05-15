// Skeleton для /admin/support — 2-колоночный layout (список тредов слева + чат справа).
export default function AdminSupportLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка обращений…</span>

      {/* Header */}
      <div className="skeleton-block" style={{ height: 56, maxWidth: 320 }} />

      {/* Two-column thread list + chat */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: 16,
          minHeight: 480,
        }}
      >
        {/* Thread list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ height: 72 }} />
          ))}
        </div>
        {/* Chat panel */}
        <div className="skeleton-block" style={{ height: 480 }} />
      </div>
    </div>
  )
}
