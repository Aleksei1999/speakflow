// Helpers для Phase 1.3/1.4 cron-pipeline'ов.
//
// listRecordingChunks → найти все chunk-{role}-NNNNN.* в Storage
//   под префиксом lesson_recordings.storage_prefix.
// downloadRecordingForRole → склеить чанки одной роли (T или S) в
//   единый Buffer для передачи в OpenAI audio.transcriptions.
//
// Все вызовы идут от service_role клиента — RLS на storage.objects
// открыт только участникам урока через signed URL, наш cron ходит
// напрямую.

import type { createAdminClient } from "@/lib/supabase/admin"

type Admin = ReturnType<typeof createAdminClient>

const BUCKET = "lesson-recordings"

export type ChunkRole = "T" | "S"

export interface ChunkFile {
  name: string
  role: ChunkRole
  seq: number
  size: number
  fullPath: string
}

/**
 * Список чанков в storage_prefix, отсортированный по роли + seq.
 * storage_prefix кончается на "/". list() поднимает имена файлов
 * без префикса, поэтому fullPath собираем сами.
 */
export async function listRecordingChunks(
  admin: Admin,
  storagePrefix: string
): Promise<ChunkFile[]> {
  const folder = storagePrefix.replace(/\/$/, "")
  const { data, error } = await admin.storage
    .from(BUCKET)
    .list(folder, { limit: 5000, sortBy: { column: "name", order: "asc" } })

  if (error) throw new Error(`list chunks failed: ${error.message}`)

  const out: ChunkFile[] = []
  for (const f of data ?? []) {
    // chunk-T-00007.webm | chunk-S-00012.m4a
    const m = f.name.match(/^chunk-([TS])-(\d{1,6})\.[a-z0-9]+$/i)
    if (!m) continue
    out.push({
      name: f.name,
      role: (m[1].toUpperCase() as ChunkRole),
      seq: Number.parseInt(m[2], 10),
      size: (f.metadata as any)?.size ?? 0,
      fullPath: `${folder}/${f.name}`,
    })
  }
  out.sort((a, b) => (a.role === b.role ? a.seq - b.seq : a.role < b.role ? -1 : 1))
  return out
}

/**
 * Скачиваем все чанки одной роли и склеиваем в один Buffer.
 * Внимание: для opus/webm простая конкатенация bytestream даёт валидный
 * webm-контейнер только при условии что MediaRecorder писал ту же
 * сессию (а это так — рекордер не reinit'ится). Whisper/gpt-4o-transcribe
 * принимает webm/ogg напрямую.
 */
export async function downloadRecordingForRole(
  admin: Admin,
  chunks: ChunkFile[],
  role: ChunkRole
): Promise<{ blob: Blob; bytes: number; ext: string } | null> {
  const list = chunks.filter((c) => c.role === role)
  if (list.length === 0) return null

  const buffers: Uint8Array[] = []
  let total = 0
  let ext = "webm"

  for (const chunk of list) {
    const { data, error } = await admin.storage.from(BUCKET).download(chunk.fullPath)
    if (error || !data) {
      console.warn(`[ai/recordings] skip chunk (${chunk.fullPath}): ${error?.message ?? "no data"}`)
      continue
    }
    const buf = new Uint8Array(await data.arrayBuffer())
    buffers.push(buf)
    total += buf.byteLength
    const dot = chunk.name.lastIndexOf(".")
    if (dot > 0) ext = chunk.name.slice(dot + 1)
  }

  if (buffers.length === 0) return null

  // Собираем единый ArrayBuffer без копирования через Buffer.concat —
  // в edge runtime Buffer не всегда доступен.
  const merged = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    merged.set(b, offset)
    offset += b.byteLength
  }

  const mime =
    ext === "ogg" ? "audio/ogg" :
    ext === "m4a" ? "audio/mp4" :
    ext === "mp3" ? "audio/mpeg" :
    "audio/webm"

  return { blob: new Blob([merged], { type: mime }), bytes: total, ext }
}
