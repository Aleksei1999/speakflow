// POST /api/admin/groups
// Admin создаёт группу от имени указанного teacher_id (в teacher_profiles.id).
// Body: { name, teacher_id, student_ids: [] }

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  teacher_id: z.string().uuid(),
  student_ids: z.array(z.string().uuid()).min(1).max(500),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try { body = await request.json() } catch { body = null }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Bad body' }, { status: 400 })
    }
    const { name, teacher_id, student_ids } = parsed.data

    const admin = createAdminClient() as any
    const { data: g, error: insErr } = await admin
      .from('teacher_groups')
      .insert({ teacher_id, name, description: null })
      .select('id')
      .single()
    if (insErr || !g?.id) {
      console.error('[admin/groups] insert', insErr)
      return NextResponse.json({ error: 'Не удалось создать группу' }, { status: 500 })
    }

    const rows = Array.from(new Set(student_ids)).map((sid) => ({ group_id: g.id, student_id: sid }))
    const { error: memErr } = await admin.from('teacher_group_members').insert(rows)
    if (memErr) {
      console.warn('[admin/groups] members insert warning', memErr)
    }

    return NextResponse.json({ ok: true, id: g.id })
  } catch (e) {
    console.error('[admin/groups][POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
