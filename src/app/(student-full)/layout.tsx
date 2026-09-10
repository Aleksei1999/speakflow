// Layout без DashboardShell для полностраничного student-дашборда
// (Figma node 2208:1427). Подроуты (`/student/schedule` и т.д.) живут
// в `(dashboard)/student/*` и получают сайдбар как обычно.
export default function StudentFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
