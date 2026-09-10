/** Фильтр материалов по типу: pdf / ppt / doc / video / audio / img. */
export const TYPE_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  ppt: [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  doc: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain',
  ],
  video: ['video/'],
  audio: ['audio/'],
  img: ['image/'],
}

export function mimeMatchesType(mime: string | null | undefined, type: string): boolean {
  if (!mime) return false
  const patterns = TYPE_MIME_MAP[type]
  if (!patterns) return false
  return patterns.some((p) => (p.endsWith('/') ? mime.startsWith(p) : mime === p))
}

/** Материал-ссылка: нет файла в Storage, только внешний URL. */
export function isLinkOnly(row: { file_url: string | null; storage_path: string | null }): boolean {
  return !row.storage_path && !!row.file_url && /^https?:\/\//i.test(row.file_url)
}
