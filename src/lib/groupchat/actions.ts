'use server'

// ---------------------------------------------------------------------------
// Server actions для группового чата.
//
// Участники группы = teacher-owner (teacher_profiles.user_id) + все
// teacher_group_members.student_id. Функция is_group_participant() в БД
// служит источником истины и для RLS, и для наших auth-гейтов.
//
// Экспортируем:
//   fetchGroupMessages(groupId)         — GET + mark_read
//   sendGroupMessage({groupId, text})   — INSERT text-only
//   uploadGroupAttachment({groupId,...})— upload в storage + INSERT
//   markGroupRead(groupId)              — UPSERT last_read_at
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSignedUrl } from '@/lib/supabase/signed-url'
import type { GroupAttachmentType, GroupChatRole, GroupMessage, GroupMessageRow } from './types'

const GROUP_ATTACHMENTS_BUCKET = 'group-chat-attachments'
const SIGNED_URL_TTL = 3600

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = any

const MESSAGES_LIMIT = 200

async function requireUser(): Promise<{ userId: string; role: GroupChatRole }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')
  const role = (profile as { role: string }).role
  if (role !== 'teacher' && role !== 'student' && role !== 'admin') {
    throw new Error(`Unsupported role: ${role}`)
  }
  return { userId: user.id, role: role as GroupChatRole }
}

async function tryGetUser() {
  try {
    return await requireUser()
  } catch {
    return null
  }
}

/**
 * Проверка «пользователь — участник группы». Дублирует SQL-функцию
 * is_group_participant (там она SECURITY DEFINER для RLS), а здесь нужна
 * для явного 403 в server actions.
 */
async function assertParticipant(admin: UntypedSupabase, groupId: string, userId: string) {
  const { data: g } = await admin
    .from('teacher_groups')
    .select('teacher_id')
    .eq('id', groupId)
    .maybeSingle()
  if (!g) throw new Error('Группа не найдена')
  const teacherProfileId = (g as { teacher_id: string }).teacher_id

  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const isOwner = !!(tp && (tp as { id: string }).id === teacherProfileId)
  if (isOwner) return

  const { data: mem } = await admin
    .from('teacher_group_members')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('student_id', userId)
    .maybeSingle()
  if (mem) return

  const { data: prof } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (prof && (prof as { role: string }).role === 'admin') return

  throw new Error('Forbidden: not a group participant')
}

export async function fetchGroupMessages(groupId: string): Promise<GroupMessage[]> {
  if (!groupId) return []
  const auth = await tryGetUser()
  if (!auth) return []

  const admin = createAdminClient() as UntypedSupabase
  try {
    await assertParticipant(admin, groupId, auth.userId)
  } catch {
    return []
  }

  const { data, error } = await admin
    .from('group_messages')
    .select('id, group_id, sender_id, sender_role, text, attachment_url, attachment_type, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_LIMIT)
  if (error) throw new Error(`fetchGroupMessages: ${error.message}`)

  const rows = ((data ?? []) as GroupMessageRow[]).reverse()

  // Resolve sender name/avatar одним запросом.
  const senderIds = Array.from(new Set(rows.map((r) => r.sender_id)))
  const nameById = new Map<string, { name: string | null; avatar: string | null }>()
  if (senderIds.length > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds)
    for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
      nameById.set(p.id, { name: p.full_name, avatar: p.avatar_url })
    }
  }

  // Mark read (fire-and-forget — не блокируем возврат).
  markGroupReadInternal(admin, groupId, auth.userId).catch(() => {})

  const messages = rows.map<GroupMessage>((r) => {
    const info = nameById.get(r.sender_id)
    return {
      id: r.id,
      groupId: r.group_id,
      senderId: r.sender_id,
      senderRole: r.sender_role,
      senderName: info?.name ?? null,
      senderAvatar: info?.avatar ?? null,
      text: r.text,
      attachmentUrl: r.attachment_url,
      attachmentType: r.attachment_type,
      createdAt: r.created_at,
    }
  })

  // Подписываем storage-пути attachment-ов, чтобы фронт мог их сразу открыть.
  await signGroupAttachmentsInPlace(messages)
  return messages
}

async function signGroupAttachmentsInPlace(messages: GroupMessage[]): Promise<void> {
  const withAttach = messages.filter((m) => !!m.attachmentUrl)
  if (!withAttach.length) return
  const supabase = await createClient()
  await Promise.all(
    withAttach.map(async (m) => {
      const path = m.attachmentUrl as string
      try {
        const { signedUrl } = await createSignedUrl(supabase, GROUP_ATTACHMENTS_BUCKET, path, {
          expiresIn: SIGNED_URL_TTL,
        })
        m.attachmentUrl = signedUrl
      } catch (e) {
        console.warn('[groupchat] sign url failed', path, e)
      }
    }),
  )
}

interface SendGroupMessageInput {
  groupId: string
  text: string
}

export async function sendGroupMessage(
  { groupId, text }: SendGroupMessageInput,
): Promise<GroupMessage> {
  const trimmed = text?.trim()
  if (!groupId) throw new Error('groupId required')
  if (!trimmed) throw new Error('Empty message')
  const { userId, role } = await requireUser()

  const admin = createAdminClient() as UntypedSupabase
  await assertParticipant(admin, groupId, userId)

  const { data, error } = await admin
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: userId,
      sender_role: role,
      text: trimmed,
    })
    .select('id, group_id, sender_id, sender_role, text, attachment_url, attachment_type, created_at')
    .single()
  if (error || !data) throw new Error(`sendGroupMessage: ${error?.message ?? 'insert failed'}`)

  // Resolve own name for immediate UI render.
  const { data: prof } = await admin
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const p = prof as { full_name: string | null; avatar_url: string | null } | null

  const row = data as GroupMessageRow
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    senderName: p?.full_name ?? null,
    senderAvatar: p?.avatar_url ?? null,
    text: row.text,
    attachmentUrl: row.attachment_url,
    attachmentType: row.attachment_type,
    createdAt: row.created_at,
  }
}

interface UploadGroupAttachmentInput {
  groupId: string
  file: File
  kind: GroupAttachmentType
  /** Отображаемое имя для документов; для image/video — обычная подпись. */
  text?: string | null
}

/**
 * Загружает файл в bucket `group-chat-attachments` под путём
 * `{group_id}/{uuid}-{safe_name}` (RLS пускает участников через
 * is_group_participant), затем INSERT group_messages со ссылкой.
 * Возвращает сообщение с подписанным attachment URL для мгновенного рендера.
 */
export async function uploadGroupAttachment(
  { groupId, file, kind, text }: UploadGroupAttachmentInput,
): Promise<GroupMessage> {
  if (!groupId) throw new Error('groupId required')
  if (!file) throw new Error('file required')
  const { userId, role } = await requireUser()

  const admin = createAdminClient() as UntypedSupabase
  await assertParticipant(admin, groupId, userId)

  const supabase = await createClient()
  const safeName = sanitizeFilename(file.name || 'file')
  const objectPath = `${groupId}/${randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from(GROUP_ATTACHMENTS_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
  if (upErr) throw new Error(`uploadGroupAttachment: storage upload failed: ${upErr.message}`)

  const { data: row, error: insErr } = await admin
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: userId,
      sender_role: role,
      text: text ? text.slice(0, 250) : null,
      attachment_url: objectPath,
      attachment_type: kind,
    })
    .select('id, group_id, sender_id, sender_role, text, attachment_url, attachment_type, created_at')
    .single()
  if (insErr || !row) {
    await supabase.storage.from(GROUP_ATTACHMENTS_BUCKET).remove([objectPath]).catch(() => {})
    throw new Error(`uploadGroupAttachment: insert failed: ${insErr?.message ?? 'unknown'}`)
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  const p = prof as { full_name: string | null; avatar_url: string | null } | null

  const dbRow = row as GroupMessageRow
  const msg: GroupMessage = {
    id: dbRow.id,
    groupId: dbRow.group_id,
    senderId: dbRow.sender_id,
    senderRole: dbRow.sender_role,
    senderName: p?.full_name ?? null,
    senderAvatar: p?.avatar_url ?? null,
    text: dbRow.text,
    attachmentUrl: dbRow.attachment_url,
    attachmentType: dbRow.attachment_type,
    createdAt: dbRow.created_at,
  }
  await signGroupAttachmentsInPlace([msg])
  return msg
}

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'file'
}

export async function markGroupRead(groupId: string): Promise<void> {
  if (!groupId) return
  const auth = await tryGetUser()
  if (!auth) return
  const admin = createAdminClient() as UntypedSupabase
  await markGroupReadInternal(admin, groupId, auth.userId).catch(() => {})
}

async function markGroupReadInternal(
  admin: UntypedSupabase,
  groupId: string,
  userId: string,
): Promise<void> {
  const nowIso = new Date().toISOString()
  const { error } = await admin
    .from('group_message_reads')
    .upsert({ group_id: groupId, user_id: userId, last_read_at: nowIso }, { onConflict: 'group_id,user_id' })
  if (error) {
    console.warn('[groupchat] markGroupRead failed', error.message)
  }
}
