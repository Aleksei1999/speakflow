// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminSupportClient from "./AdminSupportClient"

export const dynamic = "force-dynamic"

type Thread = {
  id: string
  subject: string
  student_id: string | null
  student_name: string
  student_email: string | null
  student_level: string | null
  priority: "low" | "medium" | "high"
  status: "open" | "pending" | "resolved" | "closed"
  last_message_at: string
  created_at: string
  unread_count: number
  last_message_preview: string | null
}

async function loadThreads(): Promise<Thread[]> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    const cookie = hdrs.get("cookie") ?? ""
    if (!host) return []
    const res = await fetch(
      `${proto}://${host}/api/support/threads?admin=1&limit=100`,
      { headers: { cookie }, cache: "no-store" }
    )
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.threads) ? json.threads : []
  } catch {
    return []
  }
}

export default async function AdminSupportPage() {
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
  if (profile.role === "student") redirect("/student")
  if (profile.role === "teacher") redirect("/teacher")
  if (profile.role !== "admin") redirect("/login")

  const threads = await loadThreads()
  return <AdminSupportClient initial={threads} />
}
