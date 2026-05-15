"use client"
// ============================================================
// React Query provider — оборачивает (dashboard) layout.
// ------------------------------------------------------------
// Layout остаётся server component (нужен auth-redirect и
// per-request данные), а провайдер — узкий client wrapper
// внутри него. Devtools монтируются только в dev: в prod
// бандле они не появляются благодаря tree-shaking по NODE_ENV.
// ============================================================
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { getQueryClient } from "@/lib/query/client"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // getQueryClient() возвращает singleton на client'е, поэтому
  // useState/useRef тут не нужен — порядок mount/unmount роутера
  // не сбросит instance.
  const client = getQueryClient()

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
