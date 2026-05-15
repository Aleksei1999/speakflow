// Skeleton для /student/book/[teacherId] — карточка преподавателя, календарь дат,
// сетка таймслотов, шаги бронирования.
export default function StudentBookLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка бронирования…</span>

      {/* Back button + teacher header */}
      <div className="skeleton-block" style={{ height: 40, maxWidth: 200 }} />
      <div className="skeleton-block" style={{ height: 120 }} />

      {/* Calendar + slots layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        {/* Calendar */}
        <div className="skeleton-block" style={{ height: 340 }} />
        {/* Time slots grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skeleton-block" style={{ height: 40 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton-block" style={{ height: 44 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
