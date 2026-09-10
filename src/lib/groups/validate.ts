import { createAdminClient } from '@/lib/supabase/admin'

/** Все id — профили с role='student'. */
export async function assertAllStudents(ids: string[]): Promise<boolean> {
  const unique = Array.from(new Set(ids))
  if (!unique.length) return true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data } = await admin.from('profiles').select('id').eq('role', 'student').in('id', unique)
  return ((data ?? []) as Array<{ id: string }>).length === unique.length
}
