// ---------------------------------------------------------------------------
// DELETE /api/me/homework/[id]
//
// Ученик удаляет СВОЙ загруженный файл-ответ (Figma 2522:10458: у ученика в
// папке есть «Выбрать» и «Удалить»). Разрешаем только для materials, которые
// лежат в `student-uploads/{userId}/…` и расшарены этому ученику. Файлы,
// присланные учителем, удалить нельзя (403).
// ---------------------------------------------------------------------------

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'teacher-materials'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient() as any

    const { data: share } = await admin
      .from('material_shares')
      .select('material_id')
      .eq('material_id', id)
      .eq('target_type', 'student')
      .eq('target_id', user.id)
      .maybeSingle()
    if (!share) return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })

    const { data: mat } = await admin
      .from('materials')
      .select('id, storage_path')
      .eq('id', id)
      .maybeSingle()
    if (!mat) return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })

    const ownPrefix = `student-uploads/${user.id}/`
    if (!mat.storage_path || !mat.storage_path.startsWith(ownPrefix)) {
      return NextResponse.json(
        { error: 'Можно удалять только свои загруженные файлы' },
        { status: 403 },
      )
    }

    await admin.from('material_shares').delete().eq('material_id', id)
    const { error: delErr } = await admin.from('materials').delete().eq('id', id)
    if (delErr) {
      console.error('[me/homework/[id]][DELETE] materials', delErr)
      return NextResponse.json({ error: 'Не удалось удалить запись' }, { status: 500 })
    }
    const rm = await admin.storage.from(BUCKET).remove([mat.storage_path])
    if (rm.error) console.warn('[me/homework/[id]][DELETE] storage', rm.error)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/me/homework/[id]][DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
