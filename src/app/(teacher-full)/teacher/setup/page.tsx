import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import TeacherSetupForm from "./TeacherSetupForm"

export const dynamic = "force-dynamic"

// Первый вход преподавателя, созданного админом: задать свою почту и пароль.
export default async function TeacherSetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data: profile } = await admin.from("profiles").select("role, credentials_pending, full_name_ru, full_name").eq("id", user.id).maybeSingle()
  if (!profile || profile.role !== "teacher") redirect("/login")
  if (!profile.credentials_pending) redirect("/teacher")
  return <TeacherSetupForm name={profile.full_name_ru || profile.full_name || ""} />
}
