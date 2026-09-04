// POST /api/admin/students/[id]/avatar
// Multipart: file. Админ загружает аватар любого ученика.
// Файл ложится в `avatars/<studentId>/<ts>.<ext>`, profiles.avatar_url обновляется.

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin-guard"

export const dynamic = "force-dynamic"

const BUCKET = "avatars"
const MAX_BYTES = 5 * 1024 * 1024

function sanitizeExt(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,5})$/i)
  return m ? m[1].toLowerCase() : "jpg"
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const gate = await requireAdmin(supabase)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const { id } = await params
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const fd = await request.formData()
    const file = fd.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const ext = sanitizeExt(file.name || "avatar.jpg")
    const path = `${id}/${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const up = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    })
    if (up.error) {
      console.error("[admin/students/avatar] storage error", up.error)
      return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 })
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = `${pub.publicUrl}?t=${Date.now()}`

    const { error: updErr } = await admin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", id)
    if (updErr) {
      await admin.storage.from(BUCKET).remove([path]).catch(() => {})
      console.error("[admin/students/avatar] update error", updErr)
      return NextResponse.json({ error: "Не удалось сохранить аватар" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, avatar_url: publicUrl })
  } catch (e) {
    console.error("[admin/students/avatar]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
