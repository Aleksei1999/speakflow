// ---------------------------------------------------------------------------
// Групповой чат — типы. Таблица `group_messages` (см. миграцию 20260831).
// В MVP — только text; attachments можно добавить позже, зеркалит chat_messages.
// ---------------------------------------------------------------------------

export type GroupChatRole = 'teacher' | 'student' | 'admin'
export type GroupAttachmentType = 'image' | 'video' | 'document'

export interface GroupMessage {
  id: string
  groupId: string
  senderId: string
  senderName: string | null
  senderAvatar: string | null
  senderRole: GroupChatRole
  text: string | null
  attachmentUrl: string | null
  attachmentType: GroupAttachmentType | null
  createdAt: string
}

export interface GroupMessageRow {
  id: string
  group_id: string
  sender_id: string
  sender_role: GroupChatRole
  text: string | null
  attachment_url: string | null
  attachment_type: GroupAttachmentType | null
  created_at: string
}
