// GET /api/admin/materials
// Возвращает ВСЕ materials в системе (через service_role, минуя RLS).
// Только для admin. Формат ответа совпадает со /api/student/materials.

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
    const folderId = _req.nextUrl.searchParams.get('folder_id')
    let q = admin
      .from('materials')
      .select('id, title, storage_path, file_url, mime_type, file_size, created_at, folder_id')
      .order('created_at', { ascending: false })
      .limit(200)
    if (folderId) q = q.eq('folder_id', folderId)
    const { data: mats } = await q

    const rows = (mats ?? []) as any[]
    const materials = await Promise.all(
      rows.map(async (m) => {
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
          mime_type: m.mime_type,
          file_size: m.file_size,
          created_at: m.created_at,
          signed_url,
          file_url: m.file_url,
          folder_id: m.folder_id ?? null,
        }
      }),
    )

    return NextResponse.json({ materials })
  } catch (e) {
    console.error('[admin/materials]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
