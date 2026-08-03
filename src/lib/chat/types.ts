// ---------------------------------------------------------------------------
// Shared chat types for teacher↔student direct messages (chat_messages table).
//
// Отделено от типа ChatMessage внутри `StudentChat.tsx` (у того — узкая роль
// UI-модели с partial-полями). Здесь — «полная» доменная модель, приходящая
// из БД и из server actions.
// ---------------------------------------------------------------------------

export type ChatSenderRole = 'teacher' | 'student'
export type ChatAttachmentType = 'image' | 'video' | 'document'

export interface ChatMessage {
  id: string
  teacherId: string
  studentId: string
  senderRole: ChatSenderRole
  text: string | null
  attachmentUrl: string | null
  attachmentType: ChatAttachmentType | null
  createdAt: string
}

// Row shape as returned by supabase-js (snake_case).
export interface ChatMessageRow {
  id: string
  teacher_id: string
  student_id: string
  sender_role: ChatSenderRole
  text: string | null
  attachment_url: string | null
  attachment_type: ChatAttachmentType | null
  created_at: string
}

export function rowToChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    studentId: row.student_id,
    senderRole: row.sender_role,
    text: row.text,
    attachmentUrl: row.attachment_url,
    attachmentType: row.attachment_type,
    createdAt: row.created_at,
  }
}

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
