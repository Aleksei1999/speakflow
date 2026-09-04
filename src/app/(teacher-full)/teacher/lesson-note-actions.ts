"use server"

// Post-lesson teacher note — модалка «О последнем уроке» (Figma 2208-3621).
// Пишем в существующую таблицу lesson_notes (user_id = автор, content = текст,
// один-на-пользователя per lesson через UNIQUE(lesson_id, user_id)). Тот же
// стор используется API /api/lesson/notes для in-lesson заметок.
//
// Сразу после сохранения — fire-and-forget триггерим AI-summary через
// общий helper `generateLessonSummary` (если урок 'completed' и summary
// ещё нет). Раньше отчёт создавался только когда cron доберётся до
// транскрипта записи — теперь ученик получит его сразу.

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateLessonSummary } from "@/lib/ai/lesson-summary"

interface SaveInput {
  lessonId: string
  note: string
}

export async function saveTeacherLessonNote({ lessonId, note }: SaveInput): Promise<void> {
  if (!lessonId) throw new Error("lessonId required")
  const trimmed = (note ?? "").slice(0, 500)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile) throw new Error("Profile not found")
  if (profile.role !== "teacher" && profile.role !== "admin") {
    throw new Error("Forbidden: teacher role required")
  }

  const admin = createAdminClient() as any
  const { error } = await admin
    .from("lesson_notes")
    .upsert(
      {
        lesson_id: lessonId,
        user_id: user.id,
        content: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id,user_id" },
    )
  if (error) throw new Error(`saveTeacherLessonNote: ${error.message}`)

  // fire-and-forget AI-summary. Требования generateLessonSummary:
  //  - урок status='completed' (иначе вернёт 'not_completed');
  //  - summary для урока ещё нет (иначе 'already_exists');
  //  - teacherInput ≥ 10 символов (Zod-схема в route.ts, тут не форсим —
  //    helper делает fallback-текст, если OpenAI отдал пустой ответ).
  // Ошибки логируем, но не пробрасываем — заметка уже сохранена.
  if (trimmed.length >= 10) {
    void generateLessonSummary({
      lessonId,
      teacherInput: trimmed,
      admin,
    })
      .then((res) => {
        if (!res.ok && res.code !== "already_exists" && res.code !== "not_completed") {
          console.error("[lesson-note] auto-summary failed", res)
        }
      })
      .catch((err) => console.error("[lesson-note] auto-summary threw", err))
  }
}
