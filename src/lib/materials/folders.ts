"use server"

// ---------------------------------------------------------------------------
// Server-actions для папок Библиотеки/Домашки. Пул общий, писать может
// teacher/admin, читать — все авторизованные. Удаление папки удаляет
// связанные materials и их storage-объекты в bucket teacher-materials.
// ---------------------------------------------------------------------------

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type FolderKind = "library" | "homework"

export interface MaterialFolder {
  id: string
  name: string
  kind: FolderKind
  count: number
  createdAt: string
}

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = (profile as any)?.role
  if (role !== "teacher" && role !== "admin") throw new Error("Forbidden")
  return { userId: user.id, role }
}

/** Список папок с кол-вом файлов. Читать может любой авторизованный. */
export async function listFolders(kind: FolderKind): Promise<MaterialFolder[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient() as any
  const { data: folders } = await admin
    .from("material_folders")
    .select("id, name, kind, created_at")
    .eq("kind", kind)
    .order("created_at", { ascending: true })

  const list = (folders ?? []) as any[]
  if (list.length === 0) return []

  // Считаем файлы в каждой папке одним запросом.
  const { data: mats } = await admin
    .from("materials")
    .select("folder_id")
    .in("folder_id", list.map((f) => f.id))
  const counts = new Map<string, number>()
  for (const m of (mats ?? []) as any[]) {
    counts.set(m.folder_id, (counts.get(m.folder_id) ?? 0) + 1)
  }

  return list.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    count: counts.get(f.id) ?? 0,
    createdAt: f.created_at,
  }))
}

/** Создать новую папку. Возвращает id. Только teacher/admin. */
export async function createFolder(kind: FolderKind): Promise<{ id: string; name: string }> {
  const { userId } = await requireManager()
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from("material_folders")
    .insert({ kind, name: "Новая папка", created_by: userId })
    .select("id, name")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Не удалось создать папку")
  revalidatePath("/teacher"); revalidatePath("/admin"); revalidatePath("/student")
  return { id: data.id as string, name: data.name as string }
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  await requireManager()
  const trimmed = (name || "").trim().slice(0, 80) || "Новая папка"
  const admin = createAdminClient() as any
  const { error } = await admin
    .from("material_folders")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", folderId)
  if (error) throw new Error(error.message)
  revalidatePath("/teacher"); revalidatePath("/admin"); revalidatePath("/student")
}

/** Удалить папки (и все файлы внутри вместе со storage-объектами). */
export async function deleteFolders(ids: string[]): Promise<void> {
  await requireManager()
  if (!ids.length) return
  const admin = createAdminClient() as any

  const { data: mats } = await admin
    .from("materials")
    .select("id, storage_path")
    .in("folder_id", ids)
  const paths = ((mats ?? []) as any[]).map((m) => m.storage_path).filter(Boolean) as string[]
  if (paths.length) {
    await admin.storage.from("teacher-materials").remove(paths).catch(() => {})
  }
  if (mats && mats.length) {
    await admin.from("material_shares").delete().in("material_id", (mats as any[]).map((m) => m.id))
    await admin.from("materials").delete().in("id", (mats as any[]).map((m) => m.id))
  }
  const { error } = await admin.from("material_folders").delete().in("id", ids)
  if (error) throw new Error(error.message)
  revalidatePath("/teacher"); revalidatePath("/admin"); revalidatePath("/student")
}
