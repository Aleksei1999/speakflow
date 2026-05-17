"use client"
// ============================================================
// useUnreadBadges — единый источник sidebar-бейджей для всех
// разделов dashboard (student/teacher/admin).
// ------------------------------------------------------------
// Один HTTP-запрос на /api/notifications/unread-counts вместо
// N отдельных endpoint'ов на каждый раздел. Возвращает
// нормализованный объект `{ schedule, homework, materials,
// achievements, support, clubs, students, users, trial_requests }`
// (все ключи 0 по умолчанию — компонент может безусловно читать).
//
// Стратегия совпадает с useAdminSupportUnread / useTeacherClubsUnread:
//   • staleTime 60s
//   • refetchInterval 60s (чаще, чем единичные счётчики, потому что
//     это унифицированный path и dropping в кэше ниже)
//   • refetchOnWindowFocus
//   • deferred initial fetch через requestIdleCallback
//   • event listener 'unread-badges-changed' → refetch() для
//     мгновенной инвалидации после mark-seen
//
// Совместимость со старыми событиями ('support-unread-changed',
// 'teacher-clubs-seen-changed') не нужна — те хуки остаются как
// есть, новый просто их дополняет.
// ============================================================
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

export const UNREAD_BADGES_QUERY_KEY = ["unread-badges"] as const

export type UnreadCategory =
  | "schedule"
  | "homework"
  | "materials"
  | "achievements"
  | "support"
  | "clubs"
  | "students"
  | "users"
  | "trial_requests"

export type UnreadCounts = Record<UnreadCategory, number>

const ZERO_COUNTS: UnreadCounts = {
  schedule: 0,
  homework: 0,
  materials: 0,
  achievements: 0,
  support: 0,
  clubs: 0,
  students: 0,
  users: 0,
  trial_requests: 0,
}

export function useUnreadBadges(opts: { enabled: boolean }) {
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

  const query = useQuery<UnreadCounts>({
    queryKey: UNREAD_BADGES_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/notifications/unread-counts", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) return ZERO_COUNTS
      const j = (await r.json()) as { counts?: Partial<Record<UnreadCategory, unknown>> }
      const raw = j?.counts ?? {}
      const out: UnreadCounts = { ...ZERO_COUNTS }
      for (const key of Object.keys(out) as UnreadCategory[]) {
        const v = raw[key]
        if (typeof v === "number" && Number.isFinite(v) && v > 0) {
          out[key] = v
        }
      }
      return out
    },
    enabled: opts.enabled && hasIdled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  // Custom event hook so the page that just navigated into a category
  // can fire a 'unread-badges-changed' event and we immediately
  // refetch without waiting for the next interval.
  const refetch = query.refetch
  useEffect(() => {
    if (typeof window === "undefined") return
    const onChanged = () => {
      refetch()
    }
    window.addEventListener("unread-badges-changed", onChanged as EventListener)
    return () => {
      window.removeEventListener("unread-badges-changed", onChanged as EventListener)
    }
  }, [refetch])

  return query
}

/**
 * Fire-and-forget mark-seen + global refetch trigger.
 * Used by category pages on mount (see use-mark-category-seen.ts).
 */
export async function markCategorySeen(category: UnreadCategory): Promise<void> {
  try {
    await fetch("/api/notifications/mark-seen", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    })
  } catch {
    // Non-critical — counts will refresh on the next interval anyway.
  } finally {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("unread-badges-changed"))
    }
  }
}
