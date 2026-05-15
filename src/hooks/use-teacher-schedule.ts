"use client"
// ============================================================
// useTeacherSchedule — client-side кэш для /teacher/schedule.
// ------------------------------------------------------------
// queryKey: ['teacher-schedule']
// queryFn:  GET /api/teacher/schedule
//
// FIXME: текущая /teacher/schedule (1481 строка) делает свои
// запросы в браузере. Hook нужен для prefetch'а в DashboardShell
// и для будущей миграции страницы на TanStack.
// ============================================================
import { useQuery } from "@tanstack/react-query"
import type { TeacherScheduleSnapshot } from "@/app/api/teacher/schedule/route"

export const TEACHER_SCHEDULE_QUERY_KEY = ["teacher-schedule"] as const

export function useTeacherSchedule(opts: { enabled?: boolean } = {}) {
  return useQuery<TeacherScheduleSnapshot>({
    queryKey: TEACHER_SCHEDULE_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/teacher/schedule", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load teacher schedule: ${r.status}`)
      }
      return (await r.json()) as TeacherScheduleSnapshot
    },
    enabled: opts.enabled ?? true,
  })
}
