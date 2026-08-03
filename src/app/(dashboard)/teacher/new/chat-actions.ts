"use server"

// ---------------------------------------------------------------------------
// Server actions для чата teacher↔student.
//
// Никакого admin-клиента: полагаемся на RLS в chat_messages/storage.objects,
// поэтому все проверки принадлежности треда делает Postgres. Здесь только:
//   • резолвим текущего user'а,
//   • определяем teacher/student вектор,
//   • нормализуем данные из/в БД.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import { createSignedUrl } from '@/lib/supabase/signed-url'
import {
  CHAT_ATTACHMENTS_BUCKET,
  rowToChatMessage,
  type ChatAttachmentType,
  type ChatMessage,
  type ChatMessageRow,
} from '@/lib/chat/types'

// database.ts (generated) не знает про chat_messages — миграция новая.
// Пока схема не перегенерирована, работаем через untyped-view клиента.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

const MESSAGES_LIMIT = 200
const SIGNED_URL_TTL = 3600 // 1h — совпадает с default в signed-url helper

async function requireTeacher() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  // Роль читаем из profiles, чтобы страница не могла зайти как student
  // и дёрнуть эти actions. RLS сам бы это отсеял, но лучше падать явно.
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (pErr || !profile) throw new Error('Profile not found')
  if (profile.role !== 'teacher' && profile.role !== 'admin') {
    throw new Error('Forbidden: teacher role required')
  }
  return { supabase, userId: user.id as string }
}

/**
 * Возвращает последние MESSAGES_LIMIT сообщений в треде teacher↔student
 * по возрастанию created_at (для render'а сверху-вниз в UI).
 *
 * Все attachment_url в БД хранятся как storage-path (`{teacher_id}/{student_id}/...`),
 * а не как публичный URL — bucket приватный. Здесь мы генерим signed URL'ы
 * батчем и подставляем в возвращаемые ChatMessage.
 */
export async function fetchChatMessages(studentId: string): Promise<ChatMessage[]> {
  if (!studentId) return []
  const { supabase, userId } = await requireTeacher()

  const { data, error } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .select('*')
    .eq('teacher_id', userId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_LIMIT)
  if (error) throw new Error(`fetchChatMessages: ${error.message}`)

  const rows = ((data ?? []) as ChatMessageRow[]).reverse()
  const messages = rows.map(rowToChatMessage)
  await signAttachmentUrlsInPlace(supabase, messages)
  return messages
}

interface SendChatMessageInput {
  studentId: string
  text: string
}

export async function sendChatMessage({
  studentId,
  text,
}: SendChatMessageInput): Promise<ChatMessage> {
  const trimmed = text?.trim()
  if (!studentId) throw new Error('studentId required')
  if (!trimmed) throw new Error('Empty message')
  const { supabase, userId } = await requireTeacher()

  const { data, error } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .insert({
      teacher_id: userId,
      student_id: studentId,
      sender_role: 'teacher',
      text: trimmed,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(`sendChatMessage: ${error?.message ?? 'insert failed'}`)

  return rowToChatMessage(data as ChatMessageRow)
}

interface UploadChatAttachmentInput {
  studentId: string
  file: File
  kind: ChatAttachmentType
}

/**
 * Загружает файл в приватный bucket chat-attachments и вставляет row в
 * chat_messages со storage-path в поле attachment_url. Возвращаемый
 * ChatMessage.attachmentUrl — уже signed URL (готовый к <img>/<a href>).
 */
export async function uploadChatAttachment({
  studentId,
  file,
  kind,
}: UploadChatAttachmentInput): Promise<ChatMessage> {
  if (!studentId) throw new Error('studentId required')
  if (!file) throw new Error('file required')
  const { supabase, userId } = await requireTeacher()

  const safeName = sanitizeFilename(file.name || 'file')
  const objectPath = `${userId}/${studentId}/${randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
  if (upErr) throw new Error(`uploadChatAttachment: storage upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .insert({
      teacher_id: userId,
      student_id: studentId,
      sender_role: 'teacher',
      text: null,
      attachment_url: objectPath, // храним path, signed URL резолвим on-read
      attachment_type: kind,
    })
    .select('*')
    .single()
  if (insErr || !row) {
    // Best-effort cleanup: если не смогли вставить row — не оставляем сироту.
    await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).remove([objectPath]).catch(() => {})
    throw new Error(`uploadChatAttachment: insert failed: ${insErr?.message ?? 'unknown'}`)
  }

  const msg = rowToChatMessage(row as ChatMessageRow)
  await signAttachmentUrlsInPlace(supabase, [msg])
  return msg
}

// ------------------- helpers -------------------

function sanitizeFilename(raw: string): string {
  // Заменяем всё «нехорошее» (пробелы, кириллицу, спецсимволы) на _, чтобы
  // storage path/Content-Disposition вели себя предсказуемо.
  return raw
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'file'
}

async function signAttachmentUrlsInPlace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messages: ChatMessage[],
): Promise<void> {
  const withPaths = messages.filter((m) => !!m.attachmentUrl)
  if (!withPaths.length) return
  await Promise.all(
    withPaths.map(async (m) => {
      // attachmentUrl хранится как storage path (см. uploadChatAttachment).
      const path = m.attachmentUrl as string
      const { signedUrl } = await createSignedUrl(
        supabase,
        CHAT_ATTACHMENTS_BUCKET,
        path,
        { expiresIn: SIGNED_URL_TTL },
      )
      m.attachmentUrl = signedUrl
    }),
  )
}
