// Минимальный layout для полностраничного (без DashboardShell)
// дизайна student-дашборда. Копия подхода `(teacher-full)`: чтобы
// pixel-perfect макет из Figma (node 2208:1427) не оборачивался в
// DashboardShell из `(dashboard)/layout.tsx`, у которого свой padding
// и сайдбар.
//
// Дочерние подроуты (`/student/schedule`, `/student/settings` и т.д.)
// продолжают жить в `(dashboard)/student/*` группе и получают сайдбар
// как обычно — конфликта URL нет, потому что page.tsx только один.
export default function StudentFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
