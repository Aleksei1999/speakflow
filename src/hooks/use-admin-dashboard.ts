"use client"
// ============================================================
// useAdminDashboard — client-side кэш снапшота /admin.
// ------------------------------------------------------------
// queryKey: ['admin-dashboard']
// queryFn:  GET /api/admin/dashboard (требует role='admin')
//
// На 401/403 throw'аем — TanStack помечает query как error,
// клиент сам решает (показать "доступ запрещён" или редирект).
// ============================================================
import { useQuery } from "@tanstack/react-query"
import type { AdminDashboardSnapshot } from "@/app/api/admin/dashboard/route"

export const ADMIN_DASHBOARD_QUERY_KEY = ["admin-dashboard"] as const

export function useAdminDashboard(opts: { enabled?: boolean } = {}) {
  return useQuery<AdminDashboardSnapshot>({
    queryKey: ADMIN_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/admin/dashboard", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load admin dashboard: ${r.status}`)
      }
      return (await r.json()) as AdminDashboardSnapshot
    },
    // Включён только когда role === 'admin'.
    enabled: opts.enabled ?? true,
  })
}
