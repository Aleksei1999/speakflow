// Skeleton для /student/homework — раньше юзеры видели 5+ сек белого
// экрана на мобиле, потому что SSR ждал данные. Теперь Next.js покажет
// этот fallback мгновенно, потом подменит на реальный контент.
export default function StudentHomeworkLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">Загрузка домашних заданий…</span>
      <div className="skeleton-block" style={{ height: 56, maxWidth: 320 }} />
      <div className="skeleton-block" style={{ height: 96 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 140 }} />
        ))}
      </div>
    </div>
  )
}
