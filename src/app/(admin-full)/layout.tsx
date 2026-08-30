// Минимальный layout для полностраничного (без DashboardShell)
// дизайна admin-дашборда. Копия подхода `(teacher-full)` / `(student-full)`:
// чтобы pixel-perfect макет из Figma (node 2208:1206) не оборачивался в
// DashboardShell из `(dashboard)/layout.tsx`, у которого свой padding
// и сайдбар.
//
// Дочерние подроуты (`/admin/users`, `/admin/payments` и т.д.) продолжают
// жить в старой `(dashboard)/admin/*` группе и получают сайдбар как обычно —
// конфликта URL нет, потому что page.tsx только один (тут).
export default function AdminFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
