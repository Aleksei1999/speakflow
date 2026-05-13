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
 * Скачивает ОДИН чанк по пути в Storage. Возвращает Blob c корректным
 * MIME для OpenAI (whisper / gpt-4o-transcribe умеют webm/ogg/mp4/mp3).
 *
 * FIX (CRIT): раньше тут был downloadRecordingForRole, который ПОБАЙТНО
 * склеивал webm-чанки в один файл. Это давало невалидный EBML — каждый
 * MediaRecorder chunk при start(timeslice) — самостоятельный контейнер
 * с собственным header'ом. OpenAI читал только первый ~20-сек кусок
 * и возвращал пусто. Транскрипция падала на каждом уроке.
 *
 * Новый flow: cron сам обходит chunks по очереди, делает N вызовов
 * openai.audio.transcriptions.create() и склеивает тексты.
 */
export async function downloadChunk(
  admin: Admin,
  chunk: ChunkFile
): Promise<{ blob: Blob; bytes: number; ext: string } | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(chunk.fullPath)
  if (error || !data) {
    console.warn(`[ai/recordings] download chunk failed (${chunk.fullPath}): ${error?.message ?? "no data"}`)
    return null
  }
  const buf = new Uint8Array(await data.arrayBuffer())
  const dot = chunk.name.lastIndexOf(".")
  const ext = dot > 0 ? chunk.name.slice(dot + 1) : "webm"
  const mime =
    ext === "ogg" ? "audio/ogg" :
    ext === "m4a" ? "audio/mp4" :
    ext === "mp3" ? "audio/mpeg" :
    "audio/webm"
  return { blob: new Blob([buf], { type: mime }), bytes: buf.byteLength, ext }
}
