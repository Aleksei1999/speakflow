// Одноразово вкидываем маркеры звонка в чат ученика «Test Student» с любым
// его учителем (по последней активности).
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// 1) Находим Test Student.
const { data: stu } = await supa
  .from('profiles')
  .select('id, full_name, role')
  .eq('role', 'student')
  .ilike('full_name', 'Test Student')
  .maybeSingle()
if (!stu?.id) { console.error('Test Student не найден'); process.exit(1) }
console.log('student:', stu.full_name, stu.id)

// 2) Ищем teacher-чат — самое свежее сообщение где student_id = Test Student.
const { data: msgs } = await supa
  .from('chat_messages')
  .select('teacher_id, student_id, created_at')
  .eq('student_id', stu.id)
  .order('created_at', { ascending: false })
  .limit(50)

let teacherId = null
if (msgs?.length) {
  const teacherIds = Array.from(new Set(msgs.map((m) => m.teacher_id)))
  const { data: profs } = await supa.from('profiles').select('id, role, full_name').in('id', teacherIds)
  const teacherFirst = profs.find((p) => p.role === 'teacher')
  teacherId = teacherFirst?.id ?? null
  if (teacherFirst) console.log('teacher (existing chat):', teacherFirst.full_name, teacherFirst.id)
}

// Fallback: любой teacher из profiles.
if (!teacherId) {
  const { data: anyT } = await supa.from('profiles').select('id, full_name').eq('role', 'teacher').limit(1).maybeSingle()
  if (!anyT?.id) { console.error('нет ни одного teacher'); process.exit(1) }
  teacherId = anyT.id
  console.log('teacher (fresh chat):', anyT.full_name, anyT.id)
}

// 3) Вставляем два маркера от имени teacher.
const rows = [
  { teacher_id: teacherId, student_id: stu.id, sender_id: teacherId, sender_role: 'teacher', text: '__call:started' },
  { teacher_id: teacherId, student_id: stu.id, sender_id: teacherId, sender_role: 'teacher', text: '__call:ended' },
]
const { data: inserted, error: ierr } = await supa.from('chat_messages').insert(rows).select('id, text')
if (ierr) { console.error('insert failed', ierr); process.exit(1) }
console.log('inserted:', inserted)
