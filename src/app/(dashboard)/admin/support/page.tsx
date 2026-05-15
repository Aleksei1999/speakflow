// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedAdminSupportThreads } from "@/lib/cache/dashboard"
import AdminSupportClient from "./AdminSupportClient"

// Auth check uses cookies() → page is per-request dynamic. Threads come
// from getCachedAdminSupportThreads (unstable_cache, TTL 30s, tag
// 'admin-support'), invalidated on new messages / thread mutations.
export const revalidate = 30

export default async function AdminSupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role === "student") redirect("/student")
  if (role === "teacher") redirect("/teacher")
  if (role !== "admin") redirect("/login")

  let threads: any[]
  try {
    threads = await getCachedAdminSupportThreads({ limit: 100 })
  } catch (err) {
    console.error("[admin/support] cached loader failed", err)
    threads = []
  }

  return <AdminSupportClient initial={threads} />
}
