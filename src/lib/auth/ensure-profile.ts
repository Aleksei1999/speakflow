// ---------------------------------------------------------------------------
// Самолечение аккаунтов без строки profiles (триггер handle_new_user падал,
// пока в базе не было transliterate_name). Создаёт профиль из метаданных
// auth.users по тем же правилам, что триггер: роль всегда student.
// ---------------------------------------------------------------------------
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { invalidateProfile } from '@/lib/cache/invalidate'

export async function ensureProfile(user: User): Promise<{ created: boolean; role: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: existing } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (existing?.id) return { created: false, role: existing.role ?? null }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string).trim() : '')
  // Учитель появляется только через одобрение заявки админом.
  const role = 'student'
  const fullName = str('full_name') || [str('first_name'), str('last_name')].filter(Boolean).join(' ') || user.email || 'Пользователь'
  const { error } = await admin.from('profiles').insert({
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    full_name_ru: str('full_name_ru') || null,
    avatar_url: str('avatar_url') || str('picture') || null,
    role,
  })
  if (error && error.code !== '23505') {
    console.error('[ensureProfile] insert failed', error.message)
    return { created: false, role: null }
  }
  invalidateProfile(user.id)
  return { created: true, role }
}
