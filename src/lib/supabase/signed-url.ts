// ---------------------------------------------------------------------------
// signed-url.ts — единая точка получения подписанных URL'ов на Storage.
//
// Зачем:
//   • TTL по умолчанию = 1 час. Раньше в коде встречались 60-300s (chunk
//     upload — другой API), 3600s (materials) и **7 ДНЕЙ** (homework client) —
//     долгие TTL — это утечка: ссылка валидна и после revoke share/файла.
//   • Hard min = 60s — короче нет смысла (race с CDN), длиннее = не норм.
//   • Hard max = 3600s — выше нельзя для consumer-flow; если очень нужно
//     дольше (download для admin/cron) — это отдельный admin-helper.
//   • При желании можно передать `download: true` чтобы заставить браузер
//     сохранять файл с правильным именем вместо inline-preview.
//
// Использование:
//   import { createSignedUrl } from '@/lib/supabase/signed-url'
//   const { signedUrl, error } = await createSignedUrl(supabase, 'teacher-materials', path)
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'

export const SIGNED_URL_DEFAULT_TTL = 3600 // 1 hour
export const SIGNED_URL_MIN_TTL = 60       // 1 minute
export const SIGNED_URL_MAX_TTL = 3600     // 1 hour (HARD cap)

export interface CreateSignedUrlOptions {
  /** TTL в секундах. Clamped в [60, 3600]. По умолчанию 3600. */
  expiresIn?: number
  /** Имя файла для Content-Disposition. Если строка — браузер скачает с этим именем. */
  download?: string | boolean
  /** Transform options — для image previews. */
  transform?: {
    width?: number
    height?: number
    quality?: number
    resize?: 'cover' | 'contain' | 'fill'
  }
}

export interface SignedUrlResult {
  signedUrl: string | null
  path: string
  error: Error | null
}

function clampTtl(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return SIGNED_URL_DEFAULT_TTL
  if (raw < SIGNED_URL_MIN_TTL) return SIGNED_URL_MIN_TTL
  if (raw > SIGNED_URL_MAX_TTL) return SIGNED_URL_MAX_TTL
  return Math.floor(raw)
}

/**
 * Создать подписанный URL для одного файла. Wrapper над
 * supabase.storage.from(bucket).createSignedUrl.
 *
 * Возвращает плоский объект, чтобы не лазить в .data.signedUrl каждый раз.
 */
export async function createSignedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  opts: CreateSignedUrlOptions = {},
): Promise<SignedUrlResult> {
  const expiresIn = clampTtl(opts.expiresIn)
  const supaOpts: Record<string, unknown> = {}
  if (opts.download !== undefined) supaOpts.download = opts.download
  if (opts.transform) supaOpts.transform = opts.transform

  const { data, error } = await client.storage
    .from(bucket)
    // 2-arg API kept; supabase-js принимает 3-й объект options при наличии.
    .createSignedUrl(path, expiresIn, supaOpts as { download?: string | boolean })

  return {
    signedUrl: data?.signedUrl ?? null,
    path,
    error: error ?? null,
  }
}

/**
 * Создать подписанные URL'ы для нескольких файлов одним батчем.
 * Wrapper над supabase.storage.from(bucket).createSignedUrls.
 */
export async function createSignedUrls(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  opts: Pick<CreateSignedUrlOptions, 'expiresIn' | 'download'> = {},
): Promise<{ items: SignedUrlResult[]; error: Error | null }> {
  if (!paths.length) return { items: [], error: null }
  const expiresIn = clampTtl(opts.expiresIn)
  const supaOpts: Record<string, unknown> = {}
  if (opts.download !== undefined) supaOpts.download = opts.download

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn, supaOpts as { download: string | boolean })

  const items: SignedUrlResult[] = (data ?? []).map((d) => ({
    signedUrl: d?.signedUrl ?? null,
    path: d?.path ?? '',
    error: d?.error ? new Error(String(d.error)) : null,
  }))

  return { items, error: error ?? null }
}

/**
 * Хелпер для построения map { path → signedUrl } — частый паттерн,
 * когда мы хотим обогатить список материалов подписанными ссылками.
 */
export async function createSignedUrlMap(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  opts: Pick<CreateSignedUrlOptions, 'expiresIn' | 'download'> = {},
): Promise<Record<string, string>> {
  const { items } = await createSignedUrls(client, bucket, paths, opts)
  const map: Record<string, string> = {}
  for (const item of items) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl
  }
  return map
}
