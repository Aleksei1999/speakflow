// Slot assignment для chat_messages: teacher_id (slot A) и student_id (slot B) —
// семантически просто два участника. Чтобы одна пара всегда мапилась в одни слоты
// (иначе тред разъедется на две «половины»), приоритет teacher > admin > student
// в slot A; при равенстве — tie-break по UUID (меньший в slot A).

import type { ChatRole } from './types'

const ROLE_PRIORITY: Record<ChatRole, number> = {
  teacher: 0,
  admin: 1,
  student: 2,
}

export interface ChatSlots {
  slotAId: string   // → teacher_id column
  slotBId: string   // → student_id column
  meSlot: 'a' | 'b' // slot текущего user'а
  peerSlot: 'a' | 'b'
}

/**
 * Рассчитывает распределение по слотам для пары (me, peer).
 * Вход: uid+role каждого. Выход: какой uid в какой колонке, и мой слот.
 */
export function computeSlots(
  me: { id: string; role: ChatRole },
  peer: { id: string; role: ChatRole },
): ChatSlots {
  const meP = ROLE_PRIORITY[me.role]
  const peerP = ROLE_PRIORITY[peer.role]

  let aIsMe: boolean
  if (meP !== peerP) {
    aIsMe = meP < peerP
  } else {
    // При равенстве ролей — стабильный tie-break по UUID (меньший в slot A).
    aIsMe = me.id < peer.id
  }

  return aIsMe
    ? { slotAId: me.id, slotBId: peer.id, meSlot: 'a', peerSlot: 'b' }
    : { slotAId: peer.id, slotBId: me.id, meSlot: 'b', peerSlot: 'a' }
}
/**
 * По моему слоту — имя колонки read_at, которую надо обновлять.
 */
export function readAtColumn(mySlot: 'a' | 'b'): 'read_at_slot_a' | 'read_at_slot_b' {
  return mySlot === 'a' ? 'read_at_slot_a' : 'read_at_slot_b'
}
