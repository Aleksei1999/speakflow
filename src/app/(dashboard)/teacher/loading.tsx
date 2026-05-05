// Skeleton for teacher-area routes. Mirrors the rough shape of the teacher
// dashboard (rating hero + 4 stat cards + content blocks).
export default function TeacherLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка…</span>

      {/* Hero */}
      <div className="skeleton-block" style={{ height: 160 }} />

      {/* 4 stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <div className="skeleton-block" style={{ height: 96 }} />
        <div className="skeleton-block" style={{ height: 96 }} />
        <div className="skeleton-block" style={{ height: 96 }} />
        <div className="skeleton-block" style={{ height: 96 }} />
      </div>

      {/* Schedule + students columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <div className="skeleton-block" style={{ height: 320 }} />
        <div className="skeleton-block" style={{ height: 320 }} />
      </div>
    </div>
  )
}
