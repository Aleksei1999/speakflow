// Skeleton для /club/[id]/room — speaking club room: топбар с описанием клуба
// + большое Jitsi-окно + sidebar участников/чата.
export default function ClubLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 12, padding: 4 }}
    >
      <span className="sr-only">Подключение к клубу…</span>

      {/* Top bar (club title + meta) */}
      <div className="skeleton-block" style={{ height: 56 }} />

      {/* Video + sidebar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(0, 1fr)",
          gap: 12,
          minHeight: 480,
        }}
      >
        <div className="skeleton-block" style={{ height: 520 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton-block" style={{ height: 36 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ height: 44 }} />
          ))}
          <div className="skeleton-block" style={{ height: 200 }} />
        </div>
      </div>
    </div>
  )
}
