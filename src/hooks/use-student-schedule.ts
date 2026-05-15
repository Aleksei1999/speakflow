"use client"
// ============================================================
// useStudentSchedule — client-side кэш для /student/schedule.
// ------------------------------------------------------------
// queryKey: ['student-schedule']
// queryFn:  GET /api/student/schedule
//
// FIXME: текущая page.tsx делает свои Supabase-запросы напрямую
// и не использует этот hook. Endpoint и hook нужны для prefetch'а
// в DashboardShell (часть "instant tab switching"-фичи). Когда
// будем переписывать /student/schedule на TanStack — этот hook
// заменит ручной useEffect+supabase pattern на 757-й странице.
// ============================================================
import { useQuery } from "@tanstack/react-query"
import type { StudentScheduleSnapshot } from "@/app/api/student/schedule/route"

export const STUDENT_SCHEDULE_QUERY_KEY = ["student-schedule"] as const

export function useStudentSchedule(opts: { enabled?: boolean } = {}) {
  return useQuery<StudentScheduleSnapshot>({
    queryKey: STUDENT_SCHEDULE_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/student/schedule", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load student schedule: ${r.status}`)
      }
      return (await r.json()) as StudentScheduleSnapshot
    },
    enabled: opts.enabled ?? true,
  })
}
