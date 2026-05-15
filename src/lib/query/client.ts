// ============================================================
// TanStack Query client factory.
// ------------------------------------------------------------
// staleTime = 30s — синхронизирован с server-side `unstable_cache`
// TTL для get_student_dashboard / get_teacher_dashboard (см.
// src/lib/dashboard/*.ts). Пока server-кэш свежий, client тоже
// считает данные свежими и не делает refetch.
//
// gcTime = 5 min — таб может оставаться неактивным, а данные
// должны выживать переключения между вкладками dashboard.
//
// refetchOnWindowFocus + refetchOnReconnect — стандартная
// «freshness on resume» политика TanStack.
//
// Singleton pattern: на сервере (SSR) каждый запрос получает
// свежий QueryClient — иначе пользователи делят кэш. На клиенте
// один глобальный instance переживает навигацию между страницами.
// ============================================================
import { QueryClient, isServer } from "@tanstack/react-query"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
