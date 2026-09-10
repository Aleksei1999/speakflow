// ---------------------------------------------------------------------------
// Регистрация ученика = заявка у админа. Создаём pending-заявку новому ученику
// (нет ни уроков, ни заявок), идемпотентно. Вызывается из auth callback и
// со страницы кабинета ученика.
// ---------------------------------------------------------------------------
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateAdminTrialRequests } from '@/lib/cache/invalidate'

export async function ensureTrialRequest(userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (prof?.role !== 'student') return false
  const [{ data: reqs }, { data: lessons }] = await Promise.all([
    admin.from('trial_lesson_requests').select('id').eq('user_id', userId).limit(1),
    admin.from('lessons').select('id').eq('student_id', userId).limit(1),
  ])
  if ((reqs ?? []).length || (lessons ?? []).length) return false
  const { error } = await admin.from('trial_lesson_requests').insert({ user_id: userId, status: 'pending' })
  if (error) {
    // 23505 — partial unique index (одна открытая заявка на ученика): уже создана параллельно.
    if (error.code !== '23505') console.error('[ensureTrialRequest] insert failed', error.message)
    return false
  }
  // Гонка двух параллельных рендеров (push + refresh): оставляем самую раннюю pending-заявку.
  const { data: dups } = await admin
    .from('trial_lesson_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('assigned_teacher_id', null)
    .order('created_at', { ascending: true })
  const extra = ((dups ?? []) as Array<{ id: string }>).slice(1).map((d) => d.id)
  if (extra.length) await admin.from('trial_lesson_requests').delete().in('id', extra)
  invalidateAdminTrialRequests()
  return true
}
