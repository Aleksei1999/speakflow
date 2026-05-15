"use client"
// ============================================================
// useStudentDashboard — client-side кэш снапшота /student/*.
// ------------------------------------------------------------
// queryKey: ['student-dashboard']
// queryFn:  GET /api/student/dashboard (auth через cookies)
//
// Используется в компонентах, которые хотят жить-обновляться
// при действиях в другой вкладке (XP-бейдж в шапке, прогресс,
// streak и т.п.). При сменах окна TanStack делает background
// refetch согласно глобальной политике (refetchOnWindowFocus).
//
// Initial data может приходить через HydrationBoundary из
// /student/page.tsx (см. часть 4 задачи) — тогда первый рендер
// не делает HTTP-запрос вовсе.
// ============================================================
import { useQuery } from "@tanstack/react-query"
import type { StudentDashboard } from "@/lib/dashboard/student"

export const STUDENT_DASHBOARD_QUERY_KEY = ["student-dashboard"] as const

export function useStudentDashboard(opts: { enabled?: boolean } = {}) {
  return useQuery<StudentDashboard>({
    queryKey: STUDENT_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/student/dashboard", {
        credentials: "include",
        // Свежесть контролируется TanStack staleTime, не браузерным
        // HTTP-кэшем — иначе разные вкладки получали бы залипшие 200.
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load dashboard: ${r.status}`)
      }
      return (await r.json()) as StudentDashboard
    },
    // По умолчанию hook включён, но в dashboard-shell мы дёргаем его
    // только когда role === 'student' — для teacher/admin нет смысла
    // забирать /api/student/dashboard.
    enabled: opts.enabled ?? true,
  })
}
