// One-shot: сеет 6 тестовых учеников + уроки для teacher.test@raw-english.local.
// Запуск: node --env-file=.env.local scripts/seed-test-students.mjs
import { createClient } from "@supabase/supabase-js"

const TEACHER_EMAIL = process.argv[2] || "teacher.test@raw-english.local"

const STUDENTS = [
  { email: "student.alex@raw.local",   name: "Александр Петров",   level: "A1" },
  { email: "student.maria@raw.local",  name: "Мария Иванова",       level: "A2" },
  { email: "student.dmitry@raw.local", name: "Дмитрий Смирнов",     level: "B1" },
  { email: "student.anna@raw.local",   name: "Анна Кузнецова",      level: "B1" },
  { email: "student.pavel@raw.local",  name: "Павел Соколов",       level: "B2" },
  { email: "student.olga@raw.local",   name: "Ольга Морозова",      level: "A2" },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error("нет env"); process.exit(1) }
const admin = createClient(url, key)

async function findOrCreateStudent(s) {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", s.email).maybeSingle()
  if (existing?.id) return existing.id
  const res = await admin.auth.admin.createUser({
    email: s.email, password: "Student_2026!", email_confirm: true,
    user_metadata: { full_name: s.name, role: "student" },
  })
  if (res.error) throw res.error
  const uid = res.data.user.id
  await admin.from("profiles").upsert({ id: uid, email: s.email, full_name: s.name, role: "student" }, { onConflict: "id" })
  await admin.from("user_progress").upsert({ user_id: uid, english_level: s.level }, { onConflict: "user_id" })
  return uid
}

async function main() {
  console.log(`→ ищу учителя ${TEACHER_EMAIL}`)
  const { data: teacherProfile } = await admin.from("profiles").select("id").eq("email", TEACHER_EMAIL).maybeSingle()
  if (!teacherProfile?.id) throw new Error("teacher profile not found")
  const teacherUserId = teacherProfile.id

  const { data: teacherRow } = await admin.from("teacher_profiles").select("id").eq("user_id", teacherUserId).maybeSingle()
  if (!teacherRow?.id) throw new Error("teacher_profiles row missing")
  const teacherId = teacherRow.id
  console.log(`✓ teacher_profiles.id = ${teacherId}`)

  console.log("\n→ создаю/нахожу учеников")
  const studentIds = []
  for (const s of STUDENTS) {
    const id = await findOrCreateStudent(s)
    studentIds.push({ id, ...s })
    console.log(`  ✓ ${s.name} → ${id}`)
    await admin.from("user_progress").upsert({ user_id: id, english_level: s.level }, { onConflict: "user_id" })
  }

  console.log("\n→ создаю уроки (по 2 на ученика: 1 прошлый + 1 будущий)")
  const now = Date.now()
  const HOUR = 3600_000
  for (let i = 0; i < studentIds.length; i++) {
    const s = studentIds[i]
    // прошлый (для firstSeen)
    const past = new Date(now - (30 - i * 2) * 24 * HOUR).toISOString()
    // будущий (для «через N минут»)
    const future = new Date(now + (i * 3 + 2) * HOUR).toISOString()
    for (const [ts, status] of [[past, "completed"], [future, "booked"]]) {
      await admin.from("lessons").insert({
        student_id: s.id, teacher_id: teacherId,
        scheduled_at: ts, status, price: 100000, duration_minutes: 50,
      })
    }
  }
  console.log(`✓ создано ${studentIds.length * 2} уроков`)

  console.log("\n✅ готово. Обнови /teacher — должны появиться 6 учеников.")
}

main().catch((e) => { console.error("✗", e); process.exit(1) })
