// Layout без DashboardShell для полностраничного teacher-дашборда.
// Подроуты (`/teacher/schedule` и т.д.) живут в `(dashboard)/teacher/*`
// и получают сайдбар как обычно.
export default function TeacherFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
