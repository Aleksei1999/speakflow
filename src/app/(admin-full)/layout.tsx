// Layout без DashboardShell для полностраничного admin-дашборда
// (Figma node 2208:1206). Подроуты (`/admin/users` и т.д.) живут
// в `(dashboard)/admin/*` и получают сайдбар как обычно.
export default function AdminFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
