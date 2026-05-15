"use client"
// ============================================================
// useTeacherClubsUnread — фоновый поллинг бейджа «новые
// назначения в Speaking Clubs» у преподавателя.
// ------------------------------------------------------------
// Симметрично useAdminSupportUnread:
//   • queryKey: ['teacher-clubs-unread']
//   • staleTime 60s / refetchInterval 120s / focus-refetch
//   • deferred initial fetch через requestIdleCallback
//
// Совместимость с custom event 'teacher-clubs-seen-changed'
// (его эмитит TeacherClubsClient после mark_seen) поддерживается
// в DashboardShell через event-listener → refetch().
// ============================================================
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

export const TEACHER_CLUBS_UNREAD_QUERY_KEY = ["teacher-clubs-unread"] as const

export function useTeacherClubsUnread(opts: { enabled: boolean }) {
  const [hasIdled, setHasIdled] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setHasIdled(true), { timeout: 1500 })
      return () => {
        if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id)
      }
    }
    const id = setTimeout(() => setHasIdled(true), 500)
    return () => clearTimeout(id)
  }, [])

  return useQuery<number>({
    queryKey: TEACHER_CLUBS_UNREAD_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/teacher/clubs/unread-count", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) return 0
      const j = (await r.json()) as { count?: unknown }
      return typeof j?.count === "number" ? j.count : 0
    },
    enabled: opts.enabled && hasIdled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 300 * 1000,
    refetchOnWindowFocus: true,
  })
}
