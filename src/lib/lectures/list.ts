// Список опубликованных лекций (scheduled_at ≥ now) с карточкой ведущего и флагом «я записан».
// Используется и в GET /api/lectures, и на сервере в page.tsx ученика — чтобы лекторий
// рендерился сразу с реальными данными, без мигания плейсхолдеров при перезагрузке.

// @ts-nocheck
import { nameKey } from '@/lib/ru/name-match'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type LectureTeacher = { name: string; avatar_url: string | null; bio: string | null }

export type LectureListItem = {
  id: string
  title: string
  description: string | null
  host_name: string | null
  scheduled_at: string
  duration_minutes: number
  cover_url: string | null
  tag: string | null
  capacity: number | null
  slot: 'main' | 'tall' | 'small'
  price: number | null
  teacher: LectureTeacher | null
  registered: boolean
}

export async function listLecturesForCurrentUser(): Promise<LectureListItem[]> {
  const supabase = await createClient()
  const admin = createAdminClient() as any
  const nowIso = new Date().toISOString()

  const { data, error } = await (supabase as any)
    .from('lectures')
    .select('id, title, description, host_name, scheduled_at, duration_minutes, cover_url, tag, capacity, slot, price')
    .eq('is_published', true)
    .gte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as any[]

  // host_name → { avatar_url, bio } для карточки препода. Ключ — nameKey: host_name может быть
  // кириллицей («Дмитрий Кузин»), а профиль латиницей («Dmitrii Kuzin»).
  const teacherByName: Record<string, LectureTeacher> = {}
  if (rows.some((l) => (l.host_name ?? '').trim())) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('role', 'teacher')
    const profRows = (profs ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>
    const bioById: Record<string, string | null> = {}
    if (profRows.length > 0) {
      const { data: tps } = await admin
        .from('teacher_profiles')
        .select('user_id, bio')
        .in('user_id', profRows.map((p) => p.id))
      for (const tp of (tps ?? []) as Array<{ user_id: string; bio: string | null }>) bioById[tp.user_id] = tp.bio ?? null
    }
    for (const p of profRows) {
      teacherByName[nameKey(p.full_name)] = { name: p.full_name, avatar_url: p.avatar_url, bio: bioById[p.id] ?? null }
    }
  }

  // «я записан» — в расписании ученика показываем только такие лекции.
  const registeredIds = new Set<string>()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && rows.length > 0) {
    const { data: regs } = await admin
      .from('lecture_registrations')
      .select('lecture_id')
      .eq('student_id', user.id)
      .in('lecture_id', rows.map((l) => l.id))
    for (const r of (regs ?? []) as Array<{ lecture_id: string }>) registeredIds.add(r.lecture_id)
  }

  return rows.map((l) => ({
    ...l,
    teacher: teacherByName[nameKey(l.host_name)] ?? null,
    registered: registeredIds.has(l.id),
  }))
}
