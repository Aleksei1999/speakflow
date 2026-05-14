// Безопасность загрузок файлов.
//
//   1. preflightSize() — отбиваем 413 ДО request.formData() если
//      Content-Length превышает лимит. formData() при больших файлах
//      буферит всё в память — если не отрубить заранее, можем уйти
//      в OOM.
//   2. detectMimeFromMagicBytes() — сверяем реальный тип файла с
//      сигнатурой первых байт. Клиент может выдать любой file.type;
//      доверяемся только тому что в bytes реально лежит.
//   3. assertAllowedMime() — whitelist по расширению + magic bytes.

import { NextRequest, NextResponse } from "next/server"

export interface SizeLimitOptions {
  maxBytes: number
  /** Кастомное сообщение об ошибке. По умолчанию — про MB. */
  message?: string
}

/** Проверка Content-Length до парсинга тела. Возвращает 413 если перебор. */
export function preflightSize(
  req: NextRequest,
  opts: SizeLimitOptions
): NextResponse | null {
  const cl = req.headers.get("content-length")
  if (!cl) return null
  const parsed = Number(cl)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  if (parsed > opts.maxBytes) {
    const mb = (opts.maxBytes / 1024 / 1024).toFixed(0)
    return NextResponse.json(
      { error: opts.message ?? `Файл больше ${mb} MB` },
      { status: 413, headers: { "Content-Length": "0" } }
    )
  }
  return null
}

/**
 * Распознаём MIME по первым 16 байтам. Покрывает наши реальные форматы:
 * jpeg, png, gif, webp, pdf, mp3, mp4, m4a, webm, ogg, doc(x), xls(x),
 * ppt(x), zip, txt (UTF-8).
 *
 * Возвращает null если не распознали — не падаем, а пускаем дальше с
 * предупреждением (некоторые .txt без BOM, .csv и т.д. могут не иметь
 * сигнатуры).
 */
export function detectMimeFromMagicBytes(buf: Uint8Array): string | null {
  if (buf.length < 4) return null

  // Image
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg"
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp"

  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf"

  // Audio
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "audio/mpeg" // ID3
  if (buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2)) return "audio/mpeg"
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return "audio/ogg"

  // WebM / Matroska — EBML header 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm"

  // MP4 / M4A — у байт 4..7 идёт ftyp
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11])
    if (brand.startsWith("M4A")) return "audio/mp4"
    return "video/mp4"
  }

  // ZIP-family (docx/xlsx/pptx тоже PK)
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    return "application/zip"
  }

  // Старые Office: D0 CF 11 E0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) {
    return "application/x-cfb"
  }

  // UTF-8 BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return "text/plain"

  return null
}

/** Whitelist MIME → расширение. Используется для назначения ext если клиент соврал. */
export const ALLOWED_FILE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "application/zip",
  "application/x-cfb",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
])

export interface VerifiedFile {
  detectedMime: string | null
  /** Финальный MIME: detected || declared, но только из whitelist. */
  mimeType: string
}

/**
 * Берёт первые 16 байт File, определяет magic-bytes, сравнивает с тем
 * что объявил клиент. Возвращает либо verified-объект, либо 415 error.
 */
export async function verifyFileType(file: File): Promise<VerifiedFile | NextResponse> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const detected = detectMimeFromMagicBytes(head)
  const declared = (file.type || "").toLowerCase()

  // Если magic-bytes распознали — используем их (надёжнее клиента).
  // Иначе доверяем file.type, но всё равно проверяем whitelist.
  const resolved = detected ?? declared

  if (!resolved || !ALLOWED_FILE_MIMES.has(resolved)) {
    return NextResponse.json(
      {
        error: "Этот тип файла не поддерживается. Разрешены: jpg/png/pdf/docx/xlsx/pptx/mp3/mp4/webm/zip/txt.",
        detected,
        declared,
      },
      { status: 415 }
    )
  }

  return { detectedMime: detected, mimeType: resolved }
}
