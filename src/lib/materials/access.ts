// ---------------------------------------------------------------------------
// Проверка «ученик принадлежит учителю»: через lessons, принятые заявки
// (trial_lesson_requests.assigned_teacher_id) или группы учителя.
// Используется там, где учитель работает с чужими по teacher_id материалами
// (домашка, загруженная админом или самим учеником).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export async function teacherHasStudent(admin: Db, teacherProfileId: string, studentId: string): Promise<boolean> {
  const { data: lesson } = await admin
    .from('lessons')
    .select('id')
    .eq('teacher_id', teacherProfileId)
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()
  if (lesson) return true

  const { data: trial } = await admin
    .from('trial_lesson_requests')
    .select('id')
    .eq('assigned_teacher_id', teacherProfileId)
    .eq('user_id', studentId)
    .in('status', ['assigned', 'scheduled'])
    .limit(1)
    .maybeSingle()
  if (trial) return true

  const { data: groups } = await admin
    .from('teacher_groups')
    .select('id')
    .eq('teacher_id', teacherProfileId)
  const groupIds = ((groups ?? []) as Array<{ id: string }>).map((g) => g.id)
  if (!groupIds.length) return false
  const { data: member } = await admin
    .from('teacher_group_members')
    .select('group_id')
    .in('group_id', groupIds)
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()
  return !!member
}

/** Материал расшарен хотя бы одному ученику этого учителя. */
export async function materialSharedWithTeacherStudent(admin: Db, teacherProfileId: string, materialId: string): Promise<boolean> {
  const { data: shares } = await admin
    .from('material_shares')
    .select('target_id')
    .eq('material_id', materialId)
    .eq('target_type', 'student')
  for (const s of (shares ?? []) as Array<{ target_id: string }>) {
    if (s.target_id && (await teacherHasStudent(admin, teacherProfileId, s.target_id))) return true
  }
  return false
}
