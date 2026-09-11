// «История занятий» (админ) — все прошедшие уроки платформы: ученик → учитель,
// дата, статус; если по уроку есть AI-ревью (lesson_summaries) — разворачивается тут же.
// SSR, только для admin. Специально простая: список + <details> с ревью.

import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const LIMIT = 300

const STATUS_LABEL: Record<string, string> = {
  completed: "проведён",
  no_show: "неявка",
  cancelled: "отменён",
  booked: "запланирован",
  pending_payment: "ожидает оплаты",
}
const STATUS_CLASS: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  no_show: "bg-amber-50 text-amber-700",
  cancelled: "bg-neutral-100 text-neutral-500",
  booked: "bg-sky-50 text-sky-700",
  pending_payment: "bg-neutral-100 text-neutral-500",
}

type LessonRow = { id: string; scheduled_at: string; status: string; student_id: string; teacher_id: string }
type SummaryRow = {
  lesson_id: string
  summary_text: string
  vocabulary: string[]
  grammar_points: string[]
  homework: string | null
  strengths: string[]
  areas_to_improve: string[]
}

export default async function AdminHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (role !== "admin") redirect(role === "teacher" ? "/teacher" : role === "student" ? "/student" : "/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const nowIso = new Date().toISOString()

  const { data: lessonsRaw } = await admin
    .from("lessons")
    .select("id, scheduled_at, status, student_id, teacher_id")
    .lt("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: false })
    .limit(LIMIT)
  const lessons = (lessonsRaw ?? []) as LessonRow[]

  const studentName = new Map<string, string>()
  const teacherName = new Map<string, string>()
  const summaryByLesson = new Map<string, SummaryRow>()

  if (lessons.length) {
    const studentIds = [...new Set(lessons.map((l) => l.student_id))]
    const teacherIds = [...new Set(lessons.map((l) => l.teacher_id))]
    const lessonIds = lessons.map((l) => l.id)
    const [sRes, tRes, sumRes] = await Promise.all([
      admin.from("profiles").select("id, full_name").in("id", studentIds),
      admin.from("teacher_profiles").select("id, user:profiles!teacher_profiles_user_id_fkey ( full_name )").in("id", teacherIds),
      admin
        .from("lesson_summaries")
        .select("lesson_id, summary_text, vocabulary, grammar_points, homework, strengths, areas_to_improve")
        .in("lesson_id", lessonIds),
    ])
    for (const p of (sRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) studentName.set(p.id, p.full_name)
    }
    for (const t of (tRes.data ?? []) as Array<{ id: string; user: { full_name: string | null } | Array<{ full_name: string | null }> | null }>) {
      const u = Array.isArray(t.user) ? t.user[0] : t.user
      if (u?.full_name) teacherName.set(t.id, u.full_name)
    }
    for (const s of (sumRes.data ?? []) as SummaryRow[]) summaryByLesson.set(s.lesson_id, s)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">История занятий</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Дашборд
        </Link>
      </div>
      <p className="mb-6 text-sm text-neutral-500">
        Все прошедшие уроки платформы{lessons.length >= LIMIT ? ` (последние ${LIMIT})` : ""}. Ревью урока — если оно сформировано.
      </p>

      {lessons.length === 0 ? (
        <p className="rounded-2xl bg-neutral-50 p-8 text-center text-neutral-500">Прошедших занятий пока нет.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
          {lessons.map((l) => {
            const d = new Date(l.scheduled_at)
            const when = `${d.toLocaleDateString("ru", { day: "2-digit", month: "long", year: "numeric" })}, ${d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
            const summary = summaryByLesson.get(l.id)
            return (
              <li key={l.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {studentName.get(l.student_id) ?? "Ученик"} → {teacherName.get(l.teacher_id) ?? "Учитель"}
                    </div>
                    <div className="text-sm text-neutral-500">{when}</div>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-xs font-medium " + (STATUS_CLASS[l.status] ?? "bg-neutral-100 text-neutral-500")}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </div>
                {summary && (
                  <details className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-neutral-700">Ревью урока</summary>
                    <div className="mt-2 space-y-2 leading-relaxed text-neutral-800">
                      {summary.summary_text && <p>{summary.summary_text}</p>}
                      {summary.strengths?.length > 0 && <Bullets title="Сильные стороны" items={summary.strengths} />}
                      {summary.areas_to_improve?.length > 0 && <Bullets title="Над чем поработать" items={summary.areas_to_improve} />}
                      {summary.vocabulary?.length > 0 && <Bullets title="Новая лексика" items={summary.vocabulary} />}
                      {summary.grammar_points?.length > 0 && <Bullets title="Грамматика" items={summary.grammar_points} />}
                      {summary.homework && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Домашка</div>
                          <div>{summary.homework}</div>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <ul className="list-disc pl-5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}
