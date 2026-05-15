"use client"
// ============================================================
// useStudentMaterials — client-side кэш для /student/materials.
// ------------------------------------------------------------
// queryKey: ['student-materials']
// queryFn:  GET /api/student/materials
//
// FIXME: /student/materials/page.tsx уже client (она дёргает
// этот endpoint вручную через fetch). Можно мигрировать её
// на этот hook одним маленьким PR — staleTime + автоматический
// refetch on focus заменят руками рукодельный invalidation.
//
// Note: эндпоинт принимает query-params (type/level/q/sort/limit),
// но снапшот для prefetch'а в shell всегда без них (defaults).
// Если потребуется параметризованный кэш — передавай ключ
// `['student-materials', { type, level, q, sort, limit }]`.
// ============================================================
import { useQuery } from "@tanstack/react-query"

type MaterialRow = {
  id: string
  title: string | null
  description: string | null
  file_type: string | null
  mime_type: string | null
  file_size: number | null
  level: string | null
  tags: string[]
  use_count: number
  storage_path: string | null
  file_url: string | null
  lesson_id: string | null
  is_public: boolean
  created_at: string
  signed_url: string | null
}

export type StudentMaterialsResponse = {
  materials: MaterialRow[]
  counts: Record<string, number>
}

export const STUDENT_MATERIALS_QUERY_KEY = ["student-materials"] as const

export function useStudentMaterials(opts: { enabled?: boolean } = {}) {
  return useQuery<StudentMaterialsResponse>({
    queryKey: STUDENT_MATERIALS_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/student/materials", {
        credentials: "include",
        cache: "no-store",
      })
      if (!r.ok) {
        throw new Error(`Failed to load student materials: ${r.status}`)
      }
      return (await r.json()) as StudentMaterialsResponse
    },
    enabled: opts.enabled ?? true,
  })
}
