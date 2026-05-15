"use client"
// ============================================================
// useTeacherDashboard — client-side кэш снапшота /teacher/*.
// ------------------------------------------------------------
// queryKey: ['teacher-dashboard']
// queryFn:  GET /api/teacher/dashboard (auth через cookies)
//
// Симметрично useStudentDashboard. staleTime берётся из
// глобальной QueryClient policy (30s — см. providers).
// ============================================================
import { useQuery } from "@tanstack/react-query"
import type { TeacherDashboard } from "@/lib/dashboard/teacher"

export const TEACHER_DASHBOARD_QUERY_KEY = ["teacher-dashboard"] as const

export function useTeacherDashboard(opts: { enabled?: boolean } = {}) {
  return useQuery<TeacherDashboard | null>({
    queryKey: TEACHER_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/teacher/dashboard", {
        credentials: "include",
        // TanStack кэширует на клиенте; HTTP-кэш конфликтует.
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load teacher dashboard: ${r.status}`)
      }
      return (await r.json()) as TeacherDashboard | null
    },
    // Включён только когда role === 'teacher' (DashboardShell делает
    // условный enable — нет смысла дёргать teacher-API студенту).
    enabled: opts.enabled ?? true,
  })
}
