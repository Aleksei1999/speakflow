// Хелпер для чтения глобальных тарифов учителей (миграция 20260904100000).
// Три ключа в app_settings: teacher_rate_60_kopecks, _90_kopecks, _group_kopecks.

import { createAdminClient } from "@/lib/supabase/admin"

export type TeacherRates = {
  rate60Kopecks: number
  rate90Kopecks: number
  rateGroupKopecks: number
}

export async function fetchTeacherRates(): Promise<TeacherRates> {
  const admin = createAdminClient() as any
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "teacher_rate_60_kopecks",
      "teacher_rate_90_kopecks",
      "teacher_rate_group_kopecks",
    ])
  const kv = new Map<string, number>()
  for (const r of (data ?? []) as Array<{ key: string; value: unknown }>) {
    const n = typeof r.value === "number" ? r.value : Number(r.value)
    kv.set(r.key, Number.isFinite(n) ? n : 0)
  }
  return {
    rate60Kopecks: kv.get("teacher_rate_60_kopecks") ?? 0,
    rate90Kopecks: kv.get("teacher_rate_90_kopecks") ?? 0,
    rateGroupKopecks: kv.get("teacher_rate_group_kopecks") ?? 0,
  }
}

/** kopecks → «1 500» руб. Возвращает null для 0/undefined. */
export function formatRateRub(kopecks: number): string | null {
  if (!kopecks || kopecks < 0) return null
  const rub = Math.round(kopecks / 100)
  return rub.toLocaleString("ru-RU")
}
