// One-shot: создаёт тестового учителя.
// Запуск: node --env-file=.env.local scripts/create-test-teacher.mjs
import { createClient } from "@supabase/supabase-js"

const EMAIL = process.argv[2] || "teacher.test@raw-english.local"
const PASSWORD = process.argv[3] || "TestTeacher_2026!"
const FULL_NAME = process.argv[4] || "Test Teacher"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const admin = createClient(url, key)

async function main() {
  console.log(`→ creating auth user ${EMAIL}`)
  const createRes = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, role: "teacher" },
  })

  let userId
  if (createRes.error) {
    const msg = String(createRes.error.message || "").toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      console.log("↺ user exists — fetching + resetting password")
      const { data: existing } = await admin
        .from("profiles").select("id").eq("email", EMAIL).maybeSingle()
      if (!existing?.id) throw new Error("user_already_registered but no profile row")
      userId = existing.id
      await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: FULL_NAME, role: "teacher" },
      })
    } else {
      throw createRes.error
    }
  } else {
    userId = createRes.data.user.id
  }
  console.log(`✓ user_id = ${userId}`)

  console.log("→ upserting profiles row (role=teacher)")
  const { error: upErr } = await admin.from("profiles").upsert({
    id: userId, email: EMAIL, full_name: FULL_NAME, role: "teacher",
  }, { onConflict: "id" })
  if (upErr) throw upErr

  console.log("→ ensuring teacher_profiles row")
  const { data: tp } = await admin
    .from("teacher_profiles").select("user_id").eq("user_id", userId).maybeSingle()
  if (!tp) {
    const { error: tpErr } = await admin.from("teacher_profiles").insert({
      user_id: userId,
      bio: null, specializations: [], experience_years: 0,
      hourly_rate: 100000, languages: ["ru", "en"],
      rating: 0, total_reviews: 0, total_lessons: 0,
      is_verified: true, is_listed: true,
    })
    if (tpErr) throw tpErr
  }

  console.log("\n✅ Готово. Логинься:")
  console.log(`   email:    ${EMAIL}`)
  console.log(`   password: ${PASSWORD}`)
  console.log("   → http://localhost:3000/login")
}

main().catch((e) => { console.error("✗", e); process.exit(1) })
