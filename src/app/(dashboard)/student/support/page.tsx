// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import SupportClient from "./SupportClient"

// List-страница без countdown'ов: явный force-dynamic заменён на revalidate=60.
// cookies()/headers() всё равно опт-аутят рендер из кэша (per-userId).
export const revalidate = 60

export default async function StudentSupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")
  if (profile.role === "teacher") redirect("/teacher/support")
  if (profile.role === "admin") redirect("/admin/support")

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Ученик"

  return <SupportClient userId={user.id} userName={fullName} role="student" />
}
