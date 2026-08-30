// Минимальный layout для полностраничного (без DashboardShell)
// дизайна teacher-дашборда. Раньше `/teacher` лежал внутри
// `(dashboard)` группы и во время SSR/hydration успевал мелькнуть
// сайдбар DashboardShell → потом CSS-хак `.dash:has(.tr)` его
// прятал. Теперь `/teacher` живёт в отдельной route-group без
// какой-либо обёртки — flash исчез.
//
// Дочерние подроуты (`/teacher/schedule`, `/teacher/settings` и т.д.)
// продолжают жить в старой `(dashboard)/teacher/*` группе и получают
// сайдбар как обычно — конфликта URL нет.
export default function TeacherFullLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
