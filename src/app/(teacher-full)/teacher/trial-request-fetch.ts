"use server"

// Загружает pending заявки на пробный урок для дашборда учителя:
//   • status='pending' (или без assigned_teacher_id и status='new'/'assigned')
//   • не в trial_request_declines для этого учителя
//   • level_test → результат теста (если есть)

import { createAdminClient } from "@/lib/supabase/admin"
import { requireTeacher } from "@/lib/teacher/require"
import { fromRoastLevel } from "@/lib/levels/mapping"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

/** Один ответ студента на вопрос лендинг-квиза (денормализованно). */
export interface TrialAnswerLogItem {
  text: string
  options: string[]
  chosen: number
  correct: number
  lvl?: 1 | 2 | 3 | 4
}

export interface TrialApplication {
  id: string
  name: string
  level: string
  test: boolean
  createdAt: string
  /** Полный лог ответов теста (если проходил тест на лендинге). */
  testAnswers?: TrialAnswerLogItem[]
}

export async function fetchTrialApplications(): Promise<TrialApplication[]> {
  let auth: Awaited<ReturnType<typeof requireTeacher>>
  try {
    auth = await requireTeacher()
  } catch {
    return []
  }
  const admin = createAdminClient() as UntypedSupabase

  const { data: tpRow } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle()
  const teacherProfileId = (tpRow as { id: string } | null)?.id
  if (!teacherProfileId) return []

  // 1) Общая очередь: заявки без назначенного учителя.
  // 2) Персональные: админ назначил этого учителя вручную.
  const [openRes, personalRes] = await Promise.all([
    admin
      .from("trial_lesson_requests")
      .select("id, user_id, level_test_id, created_at, status")
      .is("assigned_teacher_id", null)
      .in("status", ["pending", "new"])
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("trial_lesson_requests")
      .select("id, user_id, level_test_id, created_at, status")
      .eq("assigned_teacher_id", auth.userId)
      .in("status", ["assigned", "pending", "new", "scheduled"])
      .order("created_at", { ascending: true })
      .limit(50),
  ])
  const error = openRes.error || personalRes.error
  const reqs = [
    ...((openRes.data ?? []) as any[]),
    ...((personalRes.data ?? []) as any[]),
  ]
  if (error) return []

  // Дедуп по id (та же заявка может выпасть в обоих запросах).
  const seenReq = new Set<string>()
  const requests = (reqs as Array<{
    id: string
    user_id: string
    level_test_id: string | null
    created_at: string
    status: string
  }>).filter((r) => { if (seenReq.has(r.id)) return false; seenReq.add(r.id); return true })

  // Отфильтровываем те, что этот учитель уже отклонил.
  const { data: declines } = await admin
    .from("trial_request_declines")
    .select("request_id")
    .eq("teacher_id", teacherProfileId)
  const declinedIds = new Set(
    ((declines ?? []) as Array<{ request_id: string }>).map((d) => d.request_id),
  )
  const filtered = requests.filter((r) => !declinedIds.has(r.id))

  // Joined данные: profile (name), user_progress (level), level_tests (test done?)
  const userIds = Array.from(new Set(filtered.map((r) => r.user_id)))
  // Тянем и level_tests, привязанные к request.level_test_id, И все level_tests
  // этих юзеров — чтобы уметь фолбэчиться на «последний тест юзера», если у
  // заявки нет явного level_test_id (например, тест сохранён после регистрации
  // из landing-квиза через /api/me/level-test/import, а /trial-lesson/request
  // не получил его id).
  const explicitTestIds = filtered
    .map((r) => r.level_test_id)
    .filter(Boolean) as string[]
  const [{ data: profs }, { data: progresses }, { data: userTests }] = userIds.length
    ? await Promise.all([
        admin.from("profiles").select("id, full_name").in("id", userIds),
        admin.from("user_progress").select("user_id, english_level").in("user_id", userIds),
        admin
          .from("level_tests")
          .select("id, user_id, level, answers, completed_at")
          .in("user_id", userIds)
          .order("completed_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const nameById: Record<string, string> = {}
  for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null }>) {
    nameById[p.id] = p.full_name ?? "Ученик"
  }
  const levelById: Record<string, string> = {}
  for (const p of (progresses ?? []) as Array<{ user_id: string; english_level: string | null }>) {
    // DB хранит роаст-уровни — маппим на CEFR.
    if (p.english_level) levelById[p.user_id] = fromRoastLevel(p.english_level)
  }
  // Собираем «есть ли у юзера хоть один тест» + explicit id lookup.
  const tests = (userTests ?? []) as Array<{
    id: string
    user_id: string
    level: string
    answers: unknown
    completed_at: string
  }>
  const testIds = new Set(tests.map((t) => t.id))
  const hasTestByUser = new Set(tests.map((t) => t.user_id))
  // Уровень из level_tests как fallback, если user_progress не заполнен.
  // + latest test id / answers log per user (userTests уже отсортирован DESC).
  const testLevelByUser: Record<string, string> = {}
  const latestTestByUser: Record<string, typeof tests[number]> = {}
  for (const t of tests) {
    // level_tests.level также хранится как роаст-уровень (Raw..Well Done).
    if (!testLevelByUser[t.user_id]) testLevelByUser[t.user_id] = fromRoastLevel(t.level)
    if (!latestTestByUser[t.user_id]) latestTestByUser[t.user_id] = t
  }
  const testById = new Map(tests.map((t) => [t.id, t] as const))
  const explicitIdSet = new Set(explicitTestIds)

  function extractLog(t: typeof tests[number] | undefined): TrialAnswerLogItem[] | undefined {
    if (!t) return undefined
    const raw = t.answers as { log?: unknown } | null
    if (!raw || !Array.isArray(raw.log)) return undefined
    // Санитайзим — на случай если запись из до-миграционного формата.
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

  const trialItems = filtered.map((r) => {
    const explicitOk = r.level_test_id && explicitIdSet.has(r.level_test_id) && testIds.has(r.level_test_id)
    const anyTest = hasTestByUser.has(r.user_id)
    // Приоритет для лога: явно привязанный к заявке test → иначе latest пользователя.
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

  // Лиды с лендинга, назначенные этому учителю админом.
  // Тег «тест пройден» ставим, если по email есть level_tests.
  const { data: leadsRaw } = await (admin as any)
    .from("landing_leads")
    .select("id, name, email, created_at")
    .eq("assigned_teacher_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(50)
  const leads = ((leadsRaw ?? []) as Array<{ id: string; name: string; email: string; created_at: string }>)
  let leadItems: TrialApplication[] = []
  if (leads.length) {
    const leadEmails = Array.from(new Set(leads.map((l) => l.email).filter(Boolean)))
    const { data: leadTests } = await (admin as any)
      .from("level_tests")
      .select("email, level, answers, completed_at")
      .in("email", leadEmails)
      .order("completed_at", { ascending: false })
    const testByEmail = new Map<string, { level: string; answers: unknown }>()
    for (const t of (leadTests ?? []) as Array<{ email: string; level: string; answers: unknown }>) {
      if (!testByEmail.has(t.email)) testByEmail.set(t.email, { level: t.level, answers: t.answers })
    }
    leadItems = leads.map((l) => {
      const t = testByEmail.get(l.email)
      const raw = (t?.answers as { log?: unknown } | undefined) ?? undefined
      const log = Array.isArray(raw?.log)
        ? (raw!.log as unknown[]).filter((x): x is TrialAnswerLogItem => {
            if (!x || typeof x !== "object") return false
            const o = x as Record<string, unknown>
            return typeof o.text === "string"
              && Array.isArray(o.options)
              && typeof o.chosen === "number"
              && typeof o.correct === "number"
          })
        : []
      return {
        id: `lead:${l.id}`,
        name: l.name || l.email || "Лид",
        level: t ? fromRoastLevel(t.level) : "A1",
        test: !!t,
        createdAt: l.created_at,
        testAnswers: log.length ? log : undefined,
      } satisfies TrialApplication
    })
  }

  return [...trialItems, ...leadItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
