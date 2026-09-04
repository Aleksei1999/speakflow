// ---------------------------------------------------------------------------
// Shared chat types for multiparty (teacher/student/admin) direct messages.
//
// Табличные колонки teacher_id/student_id теперь семантически «слот A / слот B»
// — участник любой роли может занять любой слот (см. миграцию
// 20260830140000_chat_messages_multiparty). Роль каждого — в profiles.role.
// sender_role хранится ради быстрой отрисовки без JOIN.
// ---------------------------------------------------------------------------

export type ChatRole = 'teacher' | 'student' | 'admin'
export type ChatAttachmentType = 'image' | 'video' | 'document'

export interface ChatMessage {
  id: string
  slotAId: string      // participant в колонке teacher_id
  slotBId: string      // participant в колонке student_id
  senderId: string
  senderRole: ChatRole
  text: string | null
  attachmentUrl: string | null
  attachmentType: ChatAttachmentType | null
  createdAt: string
  readAtSlotA: string | null
  readAtSlotB: string | null
}

// Row shape as returned by supabase-js (snake_case).
export interface ChatMessageRow {
  id: string
  teacher_id: string
  student_id: string
  sender_id: string
  sender_role: ChatRole
  text: string | null
  attachment_url: string | null
  attachment_type: ChatAttachmentType | null
  created_at: string
  read_at_slot_a: string | null
  read_at_slot_b: string | null
}

export function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    slotAId: row.teacher_id,
    slotBId: row.student_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    text: row.text,
    attachmentUrl: row.attachment_url,
    attachmentType: row.attachment_type,
    createdAt: row.created_at,
    readAtSlotA: row.read_at_slot_a,
    readAtSlotB: row.read_at_slot_b,
  }
}

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
