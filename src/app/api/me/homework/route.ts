// ---------------------------------------------------------------------------
// GET /api/me/homework
//
// Возвращает materials, привязанные лично к текущему ученику через
// material_shares(target_type='student', target_id=me).
// В отличие от /api/student/materials (public + shares + lesson-participant),
// здесь только «личная домашка», которую расшарил учитель.
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSignedUrl } from '@/lib/supabase/signed-url'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient() as any

    const { data: shares } = await admin
      .from('material_shares')
      .select('material_id, created_at')
      .eq('target_type', 'student')
      .eq('target_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const materialIds = ((shares ?? []) as Array<{ material_id: string }>)
      .map((s) => s.material_id)
      .filter(Boolean)
    if (!materialIds.length) return NextResponse.json({ materials: [] })

    const { data: mats } = await admin
      .from('materials')
      .select('id, title, storage_path, file_url, mime_type, file_size, created_at')
      .in('id', materialIds)

    const rows = (mats ?? []) as Array<{
      id: string
      title: string
      storage_path: string | null
      file_url: string | null
      mime_type: string | null
      file_size: number | null
      created_at: string
    }>

    const materials = await Promise.all(
      rows.map(async (m) => {
        let signed_url: string | null = null
        if (m.storage_path) {
          try {
            const { signedUrl } = await createSignedUrl(supabase, 'teacher-materials', m.storage_path, {
              expiresIn: 3600,
            })
            signed_url = signedUrl
          } catch (e) {
            console.warn('[me/homework] sign url failed', m.storage_path, e)
          }
        }
        // ВАЖНО: НЕ падаем на m.file_url — в БД лежат протухшие signed URLs
        // (iat/exp с момента загрузки, никогда не обновляются). Если signing
        // не сработал — возвращаем null, клиент покажет как «не открывается».
        // Внешние http-линки (пабличные) как file_url тоже редко — оставляем
        // только если это НЕ /storage/v1/object/sign/ URL.
        const isStoredSigned = !!m.file_url && /\/storage\/v1\/object\/sign\//.test(m.file_url)
        return {
          id: m.id,
          title: m.title,
          mime_type: m.mime_type,
          file_size: m.file_size,
          created_at: m.created_at,
          signed_url: signed_url ?? (isStoredSigned ? null : m.file_url),
        }
      }),
    )

    // Сохраняем порядок shares (свежие сверху).
    const order = new Map(materialIds.map((id, i) => [id, i]))
    materials.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

    return NextResponse.json({ materials })
  } catch (e) {
    console.error('[api/me/homework][GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
