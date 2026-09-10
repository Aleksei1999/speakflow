// ---------------------------------------------------------------------------
// Кто с кем может переписываться: админ — со всеми, учитель — со своими
// учениками, ученик — со своими учителями. Иначе любой авторизованный мог
// открыть тред с любым profiles.id.
// ---------------------------------------------------------------------------
import { teacherHasStudent } from '@/lib/materials/access'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any
type Party = { id: string; role: 'teacher' | 'student' | 'admin' }

export async function canChat(admin: Db, me: Party, peer: Party): Promise<boolean> {
  if (me.id === peer.id) return false
  if (me.role === 'admin' || peer.role === 'admin') return true
  if (me.role === peer.role) return false
  const teacherUserId = me.role === 'teacher' ? me.id : peer.id
  const studentId = me.role === 'student' ? me.id : peer.id
  const { data: tp } = await admin.from('teacher_profiles').select('id').eq('user_id', teacherUserId).maybeSingle()
  const tpId = (tp as { id: string } | null)?.id
  if (!tpId) return false
  return teacherHasStudent(admin, tpId, studentId)
}
