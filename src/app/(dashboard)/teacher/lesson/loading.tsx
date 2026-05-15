// Skeleton для /teacher/lesson/[lessonId] — тот же шейп Jitsi-комнаты что
// у студента: топбар + видео + sidebar заметок/чата/материалов.
export default function TeacherLessonLoading() {
  return (
    <div
      className="dashboard-content"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: 12, padding: 4 }}
    >
      <span className="sr-only">Подключение к уроку…</span>

      {/* Top bar */}
      <div className="skeleton-block" style={{ height: 48 }} />

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
          <div className="skeleton-block" style={{ height: 240 }} />
          <div className="skeleton-block" style={{ height: 236 }} />
        </div>
      </div>
    </div>
  )
}
