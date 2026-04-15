import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const lessonId = formData.get('lessonId') as string
    const userId = formData.get('userId') as string
    const title = formData.get('title') as string

    if (!file || !lessonId || !userId) {
      return NextResponse.json({ error: 'Missing file or params' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `lessons/${lessonId}/${Date.now()}-${file.name}`

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('lesson-files')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      // If bucket doesn't exist, create it
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await admin.storage.createBucket('lesson-files', { public: true })
        const { error: retryError } = await admin.storage
          .from('lesson-files')
          .upload(path, file, { contentType: file.type })
        if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 })
      } else {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('lesson-files').getPublicUrl(path)

    // Save to lesson_materials
    const { data: mat, error: matError } = await (admin.from('lesson_materials') as any)
      .insert({
        lesson_id: lessonId,
        teacher_id: userId,
        title: title || file.name,
        file_url: urlData.publicUrl,
        content: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
      })
      .select()
      .single()

    if (matError) return NextResponse.json({ error: matError.message }, { status: 500 })
    return NextResponse.json(mat)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}
