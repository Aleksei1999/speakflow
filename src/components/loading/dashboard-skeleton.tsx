// Универсальный skeleton для dashboard-страниц студента и преподавателя.
// Используется через простой re-export в каждом */loading.tsx файле —
// Next.js рендерит его пока SSR-страница тащит данные.

export interface DashboardSkeletonProps {
  /** Подпись для screen-reader'а. */
  label?: string
  /** Сколько карточек-плиток рисовать (default 4). */
  cardCount?: number
  /** Высота карточек, px (default 140). */
  cardHeight?: number
  /** Высота главного hero-блока, px (default 96). */
  heroHeight?: number
}

export function DashboardSkeleton({
  label = "Загрузка…",
  cardCount = 4,
  cardHeight = 140,
  heroHeight = 96,
}: DashboardSkeletonProps) {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}
    >
      <span className="sr-only">{label}</span>
      <div className="skeleton-block" style={{ height: 56, maxWidth: 320 }} />
      <div className="skeleton-block" style={{ height: heroHeight }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="skeleton-block"
            style={{ height: cardHeight }}
          />
        ))}
      </div>
    </div>
  )
}
