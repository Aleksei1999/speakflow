// GET /api/admin/teachers/[id]
// Полные данные учителя для модалки админа:
//   ФИО, email, phone, avatar, teacher_profile.bio,
//   lessons_this_month / lessons_this_year (счётчик уроков).
//
// PATCH /api/admin/teachers/[id]
// Обновление avatar_url (после аплода в storage).

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await ensureAdmin()
  if ('error' in guard) return guard.error
  const { id } = await ctx.params
  const admin = createAdminClient() as any

  // profile
  const { data: prof } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, email, phone')
    .eq('id', id)
    .maybeSingle()
  if (!prof) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // teacher_profile (для bio + hourly_rate + teacher_profile.id для counts)
  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('id, bio, hourly_rate')
    .eq('user_id', id)
    .maybeSingle()

  let lessonsMonth = 0
  let lessonsYear = 0
  if (tp?.id) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()
    const [mRes, yRes] = await Promise.all([
      admin.from('lessons').select('id', { count: 'exact', head: true }).eq('teacher_id', tp.id).gte('scheduled_at', monthStart),
      admin.from('lessons').select('id', { count: 'exact', head: true }).eq('teacher_id', tp.id).gte('scheduled_at', yearStart),
    ])
    lessonsMonth = mRes.count ?? 0
    lessonsYear = yRes.count ?? 0
  }

  return NextResponse.json({
    id: prof.id,
    full_name: prof.full_name,
    email: prof.email,
    phone: prof.phone,
    avatar_url: prof.avatar_url,
    bio: tp?.bio ?? null,
    hourly_rate: tp?.hourly_rate ?? null,
    lessons_this_month: lessonsMonth,
    lessons_this_year: lessonsYear,
    teacher_profile_id: tp?.id ?? null,
  })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await ensureAdmin()
  if ('error' in guard) return guard.error
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof body.avatar_url === 'string') patch.avatar_url = body.avatar_url
  if (typeof body.bio === 'string') {
    // bio живёт в teacher_profiles → отдельный запрос
    const admin = createAdminClient() as any
    await admin.from('teacher_profiles').update({ bio: body.bio }).eq('user_id', id)
  }
  if (Object.keys(patch).length > 0) {
    const admin = createAdminClient() as any
    const { error } = await admin.from('profiles').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
