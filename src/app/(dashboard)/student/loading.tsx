// Skeleton for student-area routes. Mirrors the rough shape of the student
// dashboard (XP hero + 4 stat cards + content blocks) so the page doesn't
// flash white between navigations.
export default function StudentLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка…</span>

      {/* XP hero */}
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

      {/* Two-column content (schedule + side block) */}
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
