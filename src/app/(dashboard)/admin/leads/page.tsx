// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCachedRole } from "@/lib/auth/get-role"
import AdminLeadsClient from "./AdminLeadsClient"

export const dynamic = "force-dynamic"

export default async function AdminLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "admin") {
    if (role === "teacher") redirect("/teacher")
    if (role === "student") redirect("/student")
    redirect("/login")
  }

  // Прямой запрос через admin client (bypass RLS); в UI ниже пользователь
  // может фильтровать локально по статусу. Кэш не нужен — трафик низкий.
  const admin = createAdminClient()
  const { data: leads } = await (admin as any)
    .from("landing_leads")
    .select("id, name, email, phone, marketing_opt_in, source, country, status, admin_notes, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  return <AdminLeadsClient initial={leads ?? []} />
}
