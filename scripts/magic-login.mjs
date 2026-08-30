// One-shot: генерирует magic-link для тестового учителя.
// Открой напечатанную ссылку в браузере — войдёшь без пароля и без капчи.
// Запуск: node --env-file=.env.local scripts/magic-login.mjs [email]
import { createClient } from "@supabase/supabase-js"

const EMAIL = process.argv[2] || "teacher.test@raw-english.local"
const REDIRECT = process.argv[3] || "http://localhost:3000/teacher/new"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error("нет env"); process.exit(1) }
const admin = createClient(url, key)

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
  options: { redirectTo: REDIRECT },
})
if (error) { console.error(error); process.exit(1) }

console.log("\n🔗 Открой в браузере:\n")
console.log(data.properties.action_link)
console.log("")
