// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminTrialRequestsClient from "./AdminTrialRequestsClient"

export const dynamic = "force-dynamic"

type TeacherApplication = {
  id: string
  first_name: string
  last_name: string
  email: string
  contact: string
  notes: string | null
  status: "new" | "in_review" | "approved" | "rejected" | "archived"
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

async function safeFetch(url: string, cookie: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function loadApplications(): Promise<TeacherApplication[]> {
  const hdrs = await headers()
  const host = hdrs.get("host")
  const proto = hdrs.get("x-forwarded-proto") ?? "http"
  const cookie = hdrs.get("cookie") ?? ""
  if (!host) return []
  const json = await safeFetch(
    `${proto}://${host}/api/admin/teacher-applications`,
    cookie
  )
  return Array.isArray(json?.applications) ? json.applications : []
}

export default async function AdminTrialRequestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/login")
  if (profile.role !== "admin") {
    if (profile.role === "teacher") redirect("/teacher")
    if (profile.role === "student") redirect("/student")
    redirect("/login")
  }

  const initial = await loadApplications()
  return <AdminTrialRequestsClient initial={initial} />
}
