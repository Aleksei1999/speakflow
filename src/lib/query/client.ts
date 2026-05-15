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
// refetchOnWindowFocus: false — иначе при каждом возврате на вкладку
// (alt-tab из email/мессенджера) идёт background fetch, который
// раздражает пользователя «миганием» данных. Свежесть гарантируется
// staleTime и явными invalidateQueries после мутаций.
//
// refetchOnReconnect остаётся — после потери и восстановления
// интернета данные могли реально устареть.
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
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false,
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
