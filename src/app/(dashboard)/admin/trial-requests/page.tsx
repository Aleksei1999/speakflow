// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCachedRole } from "@/lib/auth/get-role"
import { getCachedAdminTrialRequests } from "@/lib/cache/dashboard"
import AdminTrialRequestsClient from "./AdminTrialRequestsClient"

// Auth check uses cookies() → page is per-request dynamic. Application
// list comes from getCachedAdminTrialRequests (unstable_cache, TTL 30s,
// tag 'admin-trial-requests'), invalidated on PATCH / approve.
export const revalidate = 30

export default async function AdminTrialRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const role = await getCachedRole(user.id)
  if (!role) redirect("/login")
  if (role !== "admin") {
    if (role === "teacher") redirect("/teacher")
    if (role === "student") redirect("/student")
    redirect("/login")
  }

  let initial: any[]
  try {
    initial = await getCachedAdminTrialRequests()
  } catch (err) {
    console.error("[admin/trial-requests] cached loader failed", err)
    initial = []
  }

  return <AdminTrialRequestsClient initial={initial} />
}
