'use server'

// ---------------------------------------------------------------------------
// Server actions чата — role-agnostic (teacher/student/admin).
//
// Работает поверх chat_messages со «слотами A/B» (см. миграцию
// 20260830140000). Ни в одном действии не проверяем «is teacher» —
// RLS уже пускает только участника треда.
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
  type ChatRole,
} from './types'
import { computeSlots, readAtColumn } from './slot'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

const MESSAGES_LIMIT = 200
const SIGNED_URL_TTL = 3600

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (pErr || !profile) throw new Error('Profile not found')
  if (!isChatRole(profile.role)) throw new Error(`Unsupported role: ${profile.role}`)
  return { supabase, userId: user.id as string, role: profile.role as ChatRole }
}

async function tryGetUser() {
  try {
    return await requireUser()
  } catch {
    return null
  }
}

async function loadPeerRole(supabase: UntypedSupabase, peerId: string): Promise<ChatRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', peerId)
    .single()
  if (error || !data) throw new Error(`Peer profile ${peerId} not found`)
  if (!isChatRole(data.role)) throw new Error(`Peer has unsupported role: ${data.role}`)
  return data.role as ChatRole
}

function isChatRole(role: unknown): role is ChatRole {
  return role === 'teacher' || role === 'student' || role === 'admin'
}

/**
 * Достаёт до MESSAGES_LIMIT последних сообщений в треде me↔peer, сортирует
 * по возрастанию created_at (для render'а сверху-вниз). Побочный эффект:
 * помечает все входящие сообщения в этом треде как прочитанные мной.
 */
export async function fetchThreadMessages(peerId: string): Promise<ChatMessage[]> {
  if (!peerId) return []
  const auth = await tryGetUser()
  if (!auth) return []
  const { supabase, userId, role } = auth

  const peerRole = await loadPeerRole(supabase as UntypedSupabase, peerId)
  const slots = computeSlots({ id: userId, role }, { id: peerId, role: peerRole })

  const { data, error } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .select('*')
    .eq('teacher_id', slots.slotAId)
    .eq('student_id', slots.slotBId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_LIMIT)
  if (error) throw new Error(`fetchThreadMessages: ${error.message}`)

  const rows = ((data ?? []) as ChatMessageRow[]).reverse()
  const messages = rows.map(rowToChatMessage)
  await signAttachmentUrlsInPlace(supabase, messages)

  markThreadReadInternal(supabase as UntypedSupabase, userId, slots).catch(() => {})

  return messages
}

interface SendMessageInput {
  peerId: string
  text: string
}

export async function sendMessage({ peerId, text }: SendMessageInput): Promise<ChatMessage> {
  const trimmed = text?.trim()
  if (!peerId) throw new Error('peerId required')
  if (!trimmed) throw new Error('Empty message')
  const { supabase, userId, role } = await requireUser()

  const peerRole = await loadPeerRole(supabase as UntypedSupabase, peerId)
  const slots = computeSlots({ id: userId, role }, { id: peerId, role: peerRole })

  const { data, error } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .insert({
      teacher_id: slots.slotAId,
      student_id: slots.slotBId,
      sender_id: userId,
      sender_role: role,
      text: trimmed,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(`sendMessage: ${error?.message ?? 'insert failed'}`)
  return rowToChatMessage(data as ChatMessageRow)
}

interface UploadAttachmentInput {
  peerId: string
  file: File
  kind: ChatAttachmentType
  /** Отображаемое имя (для document — показывается в бабл-е). */
  text?: string | null
}

export async function uploadAttachment({
  peerId,
  file,
  kind,
  text,
}: UploadAttachmentInput): Promise<ChatMessage> {
  if (!peerId) throw new Error('peerId required')
  if (!file) throw new Error('file required')
  const { supabase, userId, role } = await requireUser()

  const peerRole = await loadPeerRole(supabase as UntypedSupabase, peerId)
  const slots = computeSlots({ id: userId, role }, { id: peerId, role: peerRole })

  // Storage path: {slot_a_id}/{slot_b_id}/{uuid}-{name} — RLS policy пускает,
  // если auth.uid() совпадает с любым из первых двух сегментов пути.
  const safeName = sanitizeFilename(file.name || 'file')
  const objectPath = `${slots.slotAId}/${slots.slotBId}/${randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
  if (upErr) throw new Error(`uploadAttachment: storage upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await (supabase as UntypedSupabase)
    .from('chat_messages')
    .insert({
      teacher_id: slots.slotAId,
      student_id: slots.slotBId,
      sender_id: userId,
      sender_role: role,
      text: text ? text.slice(0, 250) : null,
      attachment_url: objectPath,
      attachment_type: kind,
    })
    .select('*')
    .single()
  if (insErr || !row) {
    await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).remove([objectPath]).catch(() => {})
    throw new Error(`uploadAttachment: insert failed: ${insErr?.message ?? 'unknown'}`)
  }

  const msg = rowToChatMessage(row as ChatMessageRow)
  await signAttachmentUrlsInPlace(supabase, [msg])
  return msg
}

/**
 * Помечает все входящие в треде me↔peer как прочитанные мной. Идемпотентно.
 */
export async function markThreadRead(peerId: string): Promise<void> {
  if (!peerId) return
  const auth = await tryGetUser()
  if (!auth) return
  const { supabase, userId, role } = auth
  const peerRole = await loadPeerRole(supabase as UntypedSupabase, peerId)
  const slots = computeSlots({ id: userId, role }, { id: peerId, role: peerRole })
  await markThreadReadInternal(supabase as UntypedSupabase, userId, slots)
}

async function markThreadReadInternal(
  supabase: UntypedSupabase,
  myId: string,
  slots: ReturnType<typeof computeSlots>,
): Promise<void> {
  const col = readAtColumn(slots.meSlot)
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('chat_messages')
    .update({ [col]: nowIso })
    .eq('teacher_id', slots.slotAId)
    .eq('student_id', slots.slotBId)
    .neq('sender_id', myId)
    .is(col, null)
  if (error) {
    console.warn('[chat] markThreadRead failed', error.message)
  }
}

// ------------------- helpers -------------------

function sanitizeFilename(raw: string): string {
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
