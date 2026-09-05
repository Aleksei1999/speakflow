'use server'

// ---------------------------------------------------------------------------
// Универсальный список чатов для дашборда (любой роли: teacher/student/admin).
//
// Каждый тред в chat_messages — пара (slot_a=teacher_id, slot_b=student_id).
// Для текущего юзера peer = «второй участник». Непрочитанные считаем
// по колонке read_at_slot_{my_slot} и sender_id != me.
// ---------------------------------------------------------------------------

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fromRoastLevel } from '@/lib/levels/mapping'
import type { ChatRole } from './types'

export interface DirectChatItem {
  kind: 'direct'
  peerId: string
  peerRole: ChatRole
  peerName: string
  peerAvatar: string | null
  /** CEFR-уровень собеседника (для students). Учителю нужен, чтобы шапка чата
   * рендерила пилюлю A1/A2/... — иначе пустое место. Null для teacher/admin. */
  peerLevel: string | null
  lastText: string | null
  lastSenderIsMe: boolean
  lastAt: string | null
  unreadCount: number
}

export interface GroupChatItem {
  kind: 'group'
  groupId: string
  name: string
  memberCount: number
  /** Первые до 3 участников группы (для аватар-кластера). Аватарки могут
   * быть null — клиент рисует fallback с инициалами. Никогда не фильтруем
   * по наличию avatar_url, иначе группа с 3 участниками без аватара
   * рендерилась бы как одна пустая плашка. */
  memberAvatars: Array<{ avatar: string | null; name: string }>
  /** Последнее сообщение в группе (для preview) — null если пусто. */
  lastText: string | null
  /** Отправитель последнего сообщения — я? Для «Вы:»-префикса. */
  lastSenderIsMe: boolean
  /** ISO — timestamp последнего сообщения, для сортировки. */
  lastAt: string | null
  /** Кол-во непрочитанных СО стороны текущего юзера. */
  unreadCount: number
}

export type ChatListItem = DirectChatItem | GroupChatItem

/**
 * Загружает 1:1-чаты текущего юзера (любой роли) + опционально группы.
 * Группы теперь актуальны и для teacher-owner, и для student-участника —
 * управляется флагом includeGroups (backward-compat alias includeTeacherGroups).
 */
export async function fetchChatList(
  opts: { includeTeacherGroups?: boolean; includeGroups?: boolean } = {},
): Promise<ChatListItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const meId = user.id

  const admin = createAdminClient() as any

  // Все сообщения где я — один из участников.
  const { data: msgs } = await admin
    .from('chat_messages')
    .select(
      'teacher_id, student_id, sender_id, sender_role, text, attachment_type, created_at, read_at_slot_a, read_at_slot_b',
    )
    .or(`teacher_id.eq.${meId},student_id.eq.${meId}`)
    .order('created_at', { ascending: false })
    .limit(1000)

  const perPeer = new Map<
    string,
    {
      lastText: string | null
      lastSenderIsMe: boolean
      lastAt: string
      unreadCount: number
    }
  >()
  for (const m of (msgs ?? []) as any[]) {
    const iAmSlotA = m.teacher_id === meId
    const peerId = iAmSlotA ? m.student_id : m.teacher_id
    if (!peerId) continue
    const myReadAt = iAmSlotA ? m.read_at_slot_a : m.read_at_slot_b
    const isUnread = m.sender_id !== meId && myReadAt === null

    const existing = perPeer.get(peerId)
    if (!existing) {
      const rawText = m.text ?? (m.attachment_type ? attachmentPlaceholder(m.attachment_type) : '')
      const text = humanizeCallMarker(rawText)
      perPeer.set(peerId, {
        lastText: text,
        lastSenderIsMe: m.sender_id === meId,
        lastAt: m.created_at,
        unreadCount: isUnread ? 1 : 0,
      })
    } else if (isUnread) {
      existing.unreadCount += 1
    }
  }

  const peerIds = Array.from(perPeer.keys())
  const profiles = new Map<string, { name: string; avatar: string | null; role: ChatRole }>()
  const levelByUser = new Map<string, string>()
  if (peerIds.length) {
    const [{ data: profs }, { data: progress }] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', peerIds),
      admin
        .from('user_progress')
        .select('user_id, english_level')
        .in('user_id', peerIds),
    ])
    for (const p of (profs ?? []) as any[]) {
      if (!isChatRole(p.role)) continue
      profiles.set(p.id, {
        name: p.full_name || 'Пользователь',
        avatar: p.avatar_url,
        role: p.role,
      })
    }
    for (const row of (progress ?? []) as any[]) {
      if (row.english_level) {
        // В БД после миграции 011 хранится roast-нотация ("Medium Rare"),
        // а шапка чата рендерит короткий CEFR-код (A1..C2). Конвертим тут.
        levelByUser.set(row.user_id, fromRoastLevel(String(row.english_level)))
      }
    }
  }

  const direct: DirectChatItem[] = []
  for (const pid of peerIds) {
    const prof = profiles.get(pid)
    if (!prof) continue // пир с невалидной ролью — скрываем
    const m = perPeer.get(pid)!
    direct.push({
      kind: 'direct',
      peerId: pid,
      peerRole: prof.role,
      peerName: prof.name,
      peerAvatar: prof.avatar,
      peerLevel: prof.role === 'student' ? levelByUser.get(pid) ?? null : null,
      lastText: m.lastText,
      lastSenderIsMe: m.lastSenderIsMe,
      lastAt: m.lastAt,
      unreadCount: m.unreadCount,
    })
  }
  direct.sort((a, b) => {
    const aHas = a.unreadCount > 0
    const bHas = b.unreadCount > 0
    if (aHas !== bHas) return aHas ? -1 : 1
    return (b.lastAt ?? '').localeCompare(a.lastAt ?? '')
  })

  const shouldLoadGroups = !!(opts.includeTeacherGroups || opts.includeGroups)
  const groups: GroupChatItem[] = shouldLoadGroups
    ? await fetchGroupsForUser(admin, meId)
    : []

  return [...direct, ...groups]
}

/**
 * Возвращает все группы, где текущий юзер участник (owner ИЛИ member).
 * Для каждой добавляет:
 *   • member avatars (до 3 штук),
 *   • last message text + sender + createdAt,
 *   • unread count = сообщения с created_at > my last_read_at, кроме моих.
 */
async function fetchGroupsForUser(admin: any, userId: string): Promise<GroupChatItem[]> {
  // 1) Группы где юзер teacher-owner.
  const { data: tp } = await admin
    .from('teacher_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const teacherPk = tp?.id ?? null

  const ownedIds = new Set<string>()
  if (teacherPk) {
    const { data: owned } = await admin
      .from('teacher_groups')
      .select('id')
      .eq('teacher_id', teacherPk)
    for (const g of (owned ?? []) as any[]) ownedIds.add(g.id)
  }

  // 2) Группы где юзер student-member.
  const { data: memRows } = await admin
    .from('teacher_group_members')
    .select('group_id')
    .eq('student_id', userId)
  const memberIds = new Set<string>()
  for (const m of (memRows ?? []) as any[]) memberIds.add(m.group_id)

  const allGroupIds = Array.from(new Set([...ownedIds, ...memberIds]))
  if (!allGroupIds.length) return []

  const { data: groups } = await admin
    .from('teacher_groups')
    .select('id, name, teacher_id, created_at')
    .in('id', allGroupIds)
    .order('created_at', { ascending: false })

  // 3) Members по всем группам (для аватарок + member count).
  const { data: members } = await admin
    .from('teacher_group_members')
    .select('group_id, student_id')
    .in('group_id', allGroupIds)
  const membersByGroup = new Map<string, string[]>()
  for (const m of (members ?? []) as any[]) {
    const arr = membersByGroup.get(m.group_id) ?? []
    arr.push(m.student_id)
    membersByGroup.set(m.group_id, arr)
  }
  const allStudentIds = Array.from(new Set(Array.from(membersByGroup.values()).flat()))
  // Резолвим учителей-владельцев групп: teacher_groups.teacher_id →
  // teacher_profiles.id → user_id → profiles. Учитель тоже показывается
  // как аватар в группе, чтобы студенты видели с кем занимаются, а
  // teacher-owner — что это его группа.
  const teacherProfileIds = Array.from(new Set(
    ((groups ?? []) as any[]).map((g) => g.teacher_id).filter(Boolean),
  ))
  const teacherUserIdByProfileId = new Map<string, string>()
  if (teacherProfileIds.length) {
    const { data: tps } = await admin
      .from('teacher_profiles')
      .select('id, user_id')
      .in('id', teacherProfileIds)
    for (const t of (tps ?? []) as Array<{ id: string; user_id: string }>) {
      teacherUserIdByProfileId.set(t.id, t.user_id)
    }
  }
  const teacherUserIds = Array.from(new Set(Array.from(teacherUserIdByProfileId.values())))
  const allProfileIds = Array.from(new Set([...allStudentIds, ...teacherUserIds]))
  const profileById = new Map<string, { name: string; avatar: string | null }>()
  if (allProfileIds.length) {
    const { data: profs2 } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', allProfileIds)
    for (const p of (profs2 ?? []) as any[]) {
      profileById.set(p.id, { name: p.full_name || 'Ученик', avatar: p.avatar_url })
    }
  }

  // 4) Last message per group + my read timestamps.
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    admin
      .from('group_messages')
      .select('group_id, sender_id, text, attachment_type, created_at')
      .in('group_id', allGroupIds)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin
      .from('group_message_reads')
      .select('group_id, last_read_at')
      .eq('user_id', userId)
      .in('group_id', allGroupIds),
  ])
  const lastByGroup = new Map<string, { text: string | null; senderId: string; createdAt: string }>()
  const unreadByGroup = new Map<string, number>()
  const lastReadByGroup = new Map<string, string>()
  for (const r of (reads ?? []) as any[]) {
    lastReadByGroup.set(r.group_id, r.last_read_at)
  }
  // msgs отсортированы по DESC — первый попавшийся на group_id это последнее.
  for (const m of (msgs ?? []) as any[]) {
    if (!lastByGroup.has(m.group_id)) {
      const rawText = m.text ?? (m.attachment_type ? attachmentPlaceholder(m.attachment_type) : '')
      lastByGroup.set(m.group_id, {
        text: humanizeCallMarker(rawText),
        senderId: m.sender_id,
        createdAt: m.created_at,
      })
    }
    const lastRead = lastReadByGroup.get(m.group_id)
    const isUnread = m.sender_id !== userId && (!lastRead || m.created_at > lastRead)
    if (isUnread) {
      unreadByGroup.set(m.group_id, (unreadByGroup.get(m.group_id) ?? 0) + 1)
    }
  }

  return ((groups ?? []) as any[]).map((g) => {
    const sids = membersByGroup.get(g.id) ?? []
    // Собираем список аватар: сначала учитель-owner, потом ученики.
    // Максимум 3 позиции (big / mini / nano). memberCount тоже включает teacher.
    const teacherUserId = g.teacher_id
      ? teacherUserIdByProfileId.get(g.teacher_id) ?? null
      : null
    const orderedIds: string[] = []
    if (teacherUserId) orderedIds.push(teacherUserId)
    for (const sid of sids) orderedIds.push(sid)
    const memberAvatars = orderedIds.slice(0, 3).map((uid) => {
      const p = profileById.get(uid)
      return { avatar: p?.avatar ?? null, name: p?.name ?? 'Участник' }
    })
    const last = lastByGroup.get(g.id) ?? null
    return {
      kind: 'group' as const,
      groupId: g.id,
      name: g.name,
      memberCount: orderedIds.length,
      memberAvatars,
      lastText: last?.text ?? null,
      lastSenderIsMe: last ? last.senderId === userId : false,
      lastAt: last?.createdAt ?? null,
      unreadCount: unreadByGroup.get(g.id) ?? 0,
    }
  })
}

function isChatRole(x: unknown): x is ChatRole {
  return x === 'teacher' || x === 'student' || x === 'admin'
}

// Маркеры звонка не должны утекать в preview чата. См. ChatModal.CALL_MARKERS.
function humanizeCallMarker(text: string): string {
  const t = (text ?? '').trim()
  if (t === '__call:started') return 'Звонок'
  if (t === '__call:ended') return 'Звонок окончен'
  return text
}

function attachmentPlaceholder(kind: string): string {
  if (kind === 'image') return 'Изображение'
  if (kind === 'video') return 'Видео'
  return 'Файл'
}
