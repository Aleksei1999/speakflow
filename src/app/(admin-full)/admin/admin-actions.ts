'use server'

// Server actions админки. Перенос лекции (лекторий): admin-only.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-guard'

// Таблица lectures пока не описана в types/database — работаем через нетипизированный клиент (как в page.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

export type RescheduleLectureResult = { ok: true } | { ok: false; error: string }

export async function rescheduleLecture(input: {
  lectureId: string
  scheduledAt: string
}): Promise<RescheduleLectureResult> {
  if (!input?.lectureId || typeof input.lectureId !== 'string') {
    return { ok: false, error: 'lectureId is required' }
  }
  const startMs = Date.parse(input.scheduledAt)
  if (Number.isNaN(startMs)) return { ok: false, error: 'Некорректная дата лекции' }

  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return { ok: false, error: gate.error }

  const admin = createAdminClient() as unknown as UntypedSupabase
  const { error } = await admin
    .from('lectures')
    .update({ scheduled_at: new Date(startMs).toISOString() })
    .eq('id', input.lectureId)
  if (error) return { ok: false, error: `update lectures: ${error.message}` }
  return { ok: true }
}

/** Удаление только что созданной лекции — кнопка ← в окне «Событие добавлено» (Figma 2522:2603). Admin-only. */
export async function deleteLecture(input: { lectureId: string }): Promise<RescheduleLectureResult> {
  if (!input?.lectureId || typeof input.lectureId !== 'string') return { ok: false, error: 'lectureId is required' }
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if (!gate.ok) return { ok: false, error: gate.error }
  const admin = createAdminClient() as unknown as UntypedSupabase
  const { error } = await admin.from('lectures').delete().eq('id', input.lectureId)
  if (error) return { ok: false, error: `delete lectures: ${error.message}` }
  return { ok: true }
}
