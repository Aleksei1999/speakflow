// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedAdminStudents } from "@/lib/cache/dashboard"
import AdminStudentsClient from "./AdminStudentsClient"

// Auth check uses cookies() → page is per-request dynamic. Student list
// comes from getCachedAdminStudents (unstable_cache, TTL 60s, tag
// 'admin-students'), invalidated when admin mutates a profile/role.
export const revalidate = 60

export default async function AdminStudentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Reuse cached role from layout.
  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role === "student") redirect("/student")
  if (role === "teacher") redirect("/teacher")
  if (role !== "admin") redirect("/login")

  let students: any[]
  try {
    students = await getCachedAdminStudents({ limit: 100, sort: "recent" })
  } catch (err) {
    console.error("[admin/students] cached loader failed", err)
    students = []
  }

  return <AdminStudentsClient initial={students} />
}
