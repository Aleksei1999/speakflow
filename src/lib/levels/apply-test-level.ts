import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateStudentDashboard, invalidateUserProgress } from '@/lib/cache/invalidate'

/**
 * Записать уровень по результату теста в user_progress.english_level
 * (roast-уровень: Raw..Well Done) и сбросить кэши ученика.
 */
export async function applyTestLevel(userId: string, roastLevel: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin
    .from('user_progress')
    .upsert({ user_id: userId, english_level: roastLevel }, { onConflict: 'user_id' })
  if (error) {
    console.error('[applyTestLevel] upsert failed', error.message)
    return
  }
  invalidateUserProgress(userId)
  invalidateStudentDashboard(userId)
}
