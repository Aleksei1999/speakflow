// GET /api/admin/homework
// Все material_shares где target_type='student' → materials + имя ученика.

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSignedUrl } from '@/lib/supabase/signed-url'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient() as any
    const { data: shares } = await admin
      .from('material_shares')
      .select('material_id, target_id, created_at')
      .eq('target_type', 'student')
      .order('created_at', { ascending: false })
      .limit(200)

    const materialIds = Array.from(new Set(((shares ?? []) as any[]).map((s) => s.material_id).filter(Boolean)))
    const studentIds = Array.from(new Set(((shares ?? []) as any[]).map((s) => s.target_id).filter(Boolean)))
    if (!materialIds.length) return NextResponse.json({ materials: [] })

    const [matsRes, profRes] = await Promise.all([
      admin.from('materials').select('id, title, storage_path, file_url, mime_type, file_size, created_at').in('id', materialIds),
      studentIds.length ? admin.from('profiles').select('id, full_name').in('id', studentIds) : Promise.resolve({ data: [] }),
    ])
    const matById = new Map(((matsRes.data ?? []) as any[]).map((m) => [m.id, m]))
    const nameById = new Map(((profRes.data ?? []) as any[]).map((p) => [p.id, p.full_name]))

    const materials = await Promise.all(
      ((shares ?? []) as any[]).map(async (s) => {
        const m = matById.get(s.material_id)
        if (!m) return null
        let signed_url: string | null = null
        if (m.storage_path) {
          try {
            const { signedUrl } = await createSignedUrl(supabase, 'teacher-materials', m.storage_path, { expiresIn: 3600 })
            signed_url = signedUrl
          } catch {}
        }
        return {
          id: m.id,
          title: m.title,
          student_name: nameById.get(s.target_id) ?? null,
          student_id: s.target_id,
          mime_type: m.mime_type,
          created_at: s.created_at,
          signed_url,
        }
      }),
    )

    return NextResponse.json({ materials: materials.filter(Boolean) })
  } catch (e) {
    console.error('[admin/homework]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
