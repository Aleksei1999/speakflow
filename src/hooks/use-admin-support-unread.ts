"use client"
// ============================================================
// useAdminSupportUnread — фоновый поллинг бейджа «непрочитанные
// обращения» в сайдбаре админа.
// ------------------------------------------------------------
// Раньше DashboardShell дёргал /api/admin/support/unread-count
// прямо в useEffect при mount'е + setInterval(60s). Это блочило
// first paint критическим fetch'ом и удваивало работу при HMR.
//
// Сейчас:
//   • queryKey: ['admin-support-unread']
//   • staleTime 60s — между переходами по вкладкам кэш живёт
//   • refetchInterval 120s — реже, чем старый 60s setInterval
//   • refetchOnWindowFocus — возвращение на вкладку обновит счётчик
//   • deferred initial fetch — первый запрос откладывается до
//     requestIdleCallback (или 500ms fallback), чтобы не конкурировать
//     с критичным рендером дашборда
//
// Совместимость с custom event 'support-unread-changed' (его
// эмитит AdminSupportClient после mark-read) поддерживается
// отдельным useEffect'ом в DashboardShell — он вызывает refetch().
// ============================================================
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

export const ADMIN_SUPPORT_UNREAD_QUERY_KEY = ["admin-support-unread"] as const

export function useAdminSupportUnread(opts: { enabled: boolean }) {
  // Откладываем самый первый сетевой запрос до момента, когда
  // браузер закончит критичный рендер. Без этого TanStack стартует
  // запрос синхронно в момент монтирования провайдера, что заметно
  // удлиняет TTI на медленных устройствах.
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
    queryKey: ADMIN_SUPPORT_UNREAD_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/admin/support/unread-count", {
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
