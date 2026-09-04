"use server"

// Admin версия fetchTrialApplications — как teacher-версия, но без
// teacher-guard и без trial_request_declines фильтра. Админ видит ВСЕ
// pending-заявки с логом ответов теста (для развёрнутой карточки).
//
// Бизнес-правило: заявка приходит только если ученик прошёл тест
// (test === true). Отфильтровано на месте, callers могут не заботиться.

import { createAdminClient } from "@/lib/supabase/admin"
import { fromRoastLevel } from "@/lib/levels/mapping"
import type { TrialApplication, TrialAnswerLogItem } from "@/app/(teacher-full)/teacher/trial-request-fetch"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

export async function fetchTrialApplicationsForAdmin(): Promise<TrialApplication[]> {
  const admin = createAdminClient() as UntypedSupabase

  const { data: reqs, error } = await admin
    .from("trial_lesson_requests")
    .select("id, user_id, level_test_id, created_at, status, assigned_teacher_id")
    .in("status", ["pending", "new"])
    .is("assigned_teacher_id", null)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error || !reqs) return []

  const requests = reqs as Array<{
    id: string
    user_id: string
    level_test_id: string | null
    created_at: string
    status: string
    assigned_teacher_id: string | null
  }>
  if (requests.length === 0) return []

  const userIds = Array.from(new Set(requests.map((r) => r.user_id)))
  const explicitTestIds = requests
    .map((r) => r.level_test_id)
    .filter(Boolean) as string[]

  const [{ data: profs }, { data: progresses }, { data: userTests }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", userIds),
    admin.from("user_progress").select("user_id, english_level").in("user_id", userIds),
    admin
      .from("level_tests")
      .select("id, user_id, level, answers, completed_at")
      .in("user_id", userIds)
      .order("completed_at", { ascending: false }),
  ])

  const nameById: Record<string, string> = {}
  for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) {
    nameById[p.id] = p.full_name ?? "Ученик"
  }
  const levelById: Record<string, string> = {}
  for (const p of (progresses ?? []) as Array<{ user_id: string; english_level: string | null }>) {
    if (p.english_level) levelById[p.user_id] = fromRoastLevel(p.english_level)
  }
  const tests = (userTests ?? []) as Array<{
    id: string
    user_id: string
    level: string
    answers: unknown
    completed_at: string
  }>
  const testIds = new Set(tests.map((t) => t.id))
  const hasTestByUser = new Set(tests.map((t) => t.user_id))
  const testLevelByUser: Record<string, string> = {}
  const latestTestByUser: Record<string, typeof tests[number]> = {}
  for (const t of tests) {
    if (!testLevelByUser[t.user_id]) testLevelByUser[t.user_id] = fromRoastLevel(t.level)
    if (!latestTestByUser[t.user_id]) latestTestByUser[t.user_id] = t
  }
  const testById = new Map(tests.map((t) => [t.id, t] as const))
  const explicitIdSet = new Set(explicitTestIds)

  function extractLog(t: typeof tests[number] | undefined): TrialAnswerLogItem[] | undefined {
    if (!t) return undefined
    const raw = t.answers as { log?: unknown } | null
    if (!raw || !Array.isArray(raw.log)) return undefined
    const log = raw.log.filter((x): x is TrialAnswerLogItem => {
      if (!x || typeof x !== 'object') return false
      const o = x as Record<string, unknown>
      return typeof o.text === 'string'
        && Array.isArray(o.options)
        && typeof o.chosen === 'number'
        && typeof o.correct === 'number'
    })
    return log.length ? log : undefined
  }

  const items = requests.map((r) => {
    const explicitOk = r.level_test_id && explicitIdSet.has(r.level_test_id) && testIds.has(r.level_test_id)
    const anyTest = hasTestByUser.has(r.user_id)
    const linkedTest = r.level_test_id ? testById.get(r.level_test_id) : undefined
    const logSource = linkedTest ?? latestTestByUser[r.user_id]
    return {
      id: r.id,
      name: nameById[r.user_id] ?? "Ученик",
      level: levelById[r.user_id] ?? testLevelByUser[r.user_id] ?? "A1",
      test: explicitOk || anyTest,
      createdAt: r.created_at,
      testAnswers: extractLog(logSource),
    } satisfies TrialApplication
  })

  // Бизнес-правило: если ученик не прошёл тест — заявка не показывается.
  return items.filter((i) => i.test)
}
