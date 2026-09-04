// «История занятий» — список прошедших уроков учителя с AI-ревью.
// SSR: lessons + lesson_summaries + student name.

import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

type Row = {
  lessonId: string
  scheduledAt: string
  status: string
  studentName: string | null
  summary:
    | {
        summary_text: string
        vocabulary: string[]
        grammar_points: string[]
        homework: string | null
        strengths: string[]
        areas_to_improve: string[]
        created_at: string
      }
    | null
}

export default async function TeacherSummariesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const role = await getCachedRole(user.id)
  if (role !== "teacher" && role !== "admin") {
    redirect(role === "student" ? "/student" : "/login")
  }

  const admin = createAdminClient() as any

  // teacher_profiles.id — по нему привязка lessons.teacher_id.
  const { data: tp } = await admin
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  const teacherProfileId = (tp as { id: string } | null)?.id

  const now = new Date().toISOString()
  const { data: lessonsRaw } = teacherProfileId
    ? await admin
        .from("lessons")
        .select("id, scheduled_at, status, student_id")
        .eq("teacher_id", teacherProfileId)
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: false })
        .limit(100)
    : { data: [] }

  const lessons = (lessonsRaw ?? []) as Array<{
    id: string
    scheduled_at: string
    status: string
    student_id: string
  }>

  let items: Row[] = []
  if (lessons.length) {
    const lessonIds = lessons.map((l) => l.id)
    const studentIds = Array.from(new Set(lessons.map((l) => l.student_id).filter(Boolean)))
    const [sumRes, sRes] = await Promise.all([
      admin
        .from("lesson_summaries")
        .select(
          "lesson_id, summary_text, vocabulary, grammar_points, homework, strengths, areas_to_improve, created_at",
        )
        .in("lesson_id", lessonIds),
      admin.from("profiles").select("id, full_name").in("id", studentIds),
    ])
    const sumById = new Map<string, Row["summary"]>()
    for (const s of (sumRes.data ?? []) as any[]) {
      sumById.set(s.lesson_id, {
        summary_text: s.summary_text || "",
        vocabulary: s.vocabulary ?? [],
        grammar_points: s.grammar_points ?? [],
        homework: s.homework ?? null,
        strengths: s.strengths ?? [],
        areas_to_improve: s.areas_to_improve ?? [],
        created_at: s.created_at,
      })
    }
    const studentName = new Map<string, string>()
    for (const p of (sRes.data ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) studentName.set(p.id, p.full_name)
    }
    items = lessons.map((l) => ({
      lessonId: l.id,
      scheduledAt: l.scheduled_at,
      status: l.status,
      studentName: studentName.get(l.student_id) ?? null,
      summary: sumById.get(l.id) ?? null,
    }))
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">История занятий</h1>
        <Link href="/teacher" className="text-sm text-neutral-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-neutral-50 p-8 text-center text-neutral-500">
          Прошедших занятий пока нет.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((it) => {
            const d = new Date(it.scheduledAt)
            const dateStr = d.toLocaleDateString("ru", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
            const timeStr = d.toLocaleTimeString("ru", {
              hour: "2-digit",
              minute: "2-digit",
            })
            return (
              <li
                key={it.lessonId}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">
                      {dateStr}, {timeStr}
                    </div>
                    {it.studentName && (
                      <div className="text-sm text-neutral-500">Ученик: {it.studentName}</div>
                    )}
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-medium " +
                      (it.summary
                        ? "bg-green-100 text-green-800"
                        : "bg-neutral-100 text-neutral-500")
                    }
                  >
                    {it.summary ? "AI-ревью готово" : "Ревью формируется…"}
                  </span>
                </div>

                {it.summary ? (
                  <div className="space-y-3 text-sm leading-relaxed">
                    {it.summary.summary_text && (
                      <p className="text-neutral-800">{it.summary.summary_text}</p>
                    )}
                    {it.summary.strengths.length > 0 && (
                      <Bullets title="Сильные стороны ученика" items={it.summary.strengths} tone="ok" />
                    )}
                    {it.summary.areas_to_improve.length > 0 && (
                      <Bullets
                        title="Над чем поработать"
                        items={it.summary.areas_to_improve}
                        tone="warn"
                      />
                    )}
                    {it.summary.vocabulary.length > 0 && (
                      <Bullets
                        title="Новая лексика"
                        items={it.summary.vocabulary}
                        tone="neutral"
                      />
                    )}
                    {it.summary.grammar_points.length > 0 && (
                      <Bullets
                        title="Грамматика"
                        items={it.summary.grammar_points}
                        tone="neutral"
                      />
                    )}
                    {it.summary.homework && (
                      <div className="rounded-xl bg-neutral-50 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Домашка
                        </div>
                        <div className="text-neutral-800">{it.summary.homework}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Запись урока обрабатывается ИИ. Обычно занимает несколько минут после
                    окончания занятия.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Bullets({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: "ok" | "warn" | "neutral"
}) {
  const dot =
    tone === "ok" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-neutral-400"
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-neutral-800">
            <span className={`mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
