// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import SupportClient from "../../student/support/SupportClient"

export const dynamic = "force-dynamic"

export default async function TeacherSupportPage() {
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
  if (profile.role === "student") redirect("/student/support")
  if (profile.role === "admin") redirect("/admin/support")

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Преподаватель"

  return <SupportClient userId={user.id} userName={fullName} role="teacher" />
}
