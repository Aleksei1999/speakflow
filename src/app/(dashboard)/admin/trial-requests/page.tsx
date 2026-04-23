// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminTrialRequestsClient from "./AdminTrialRequestsClient"

export const dynamic = "force-dynamic"

type TrialRequest = {
  id: string
  student_id: string | null
  student_name: string
  student_email: string | null
  student_phone: string | null
  level: string | null
  goal: string | null
  preferred_slot: string | null
  notes: string | null
  status: "new" | "processing" | "matched" | "done" | "cancelled"
  assigned_teacher_id: string | null
  assigned_teacher_name: string | null
  created_at: string
  updated_at: string
}

type TeacherOption = {
  id: string
  full_name: string
  level_range: string | null
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

async function loadSnapshot(): Promise<{
  requests: TrialRequest[]
  teachers: TeacherOption[]
}> {
  const hdrs = await headers()
  const host = hdrs.get("host")
  const proto = hdrs.get("x-forwarded-proto") ?? "http"
  const cookie = hdrs.get("cookie") ?? ""
  if (!host) return { requests: [], teachers: [] }
  const base = `${proto}://${host}`

  const [reqRes, teacherRes] = await Promise.all([
    safeFetch(`${base}/api/admin/trial-requests`, cookie),
    safeFetch(`${base}/api/teachers?limit=100`, cookie),
  ])

  return {
    requests: Array.isArray(reqRes?.requests) ? reqRes.requests : [],
    teachers: Array.isArray(teacherRes?.teachers)
      ? teacherRes.teachers.map((t: any) => ({
          id: t.id,
          full_name: t.full_name || t.name || "—",
          level_range: t.level_range ?? null,
        }))
      : [],
  }
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
  if (profile.role === "student") redirect("/student")
  if (profile.role === "teacher") redirect("/teacher")
  if (profile.role !== "admin") redirect("/login")

  const snap = await loadSnapshot()
  return <AdminTrialRequestsClient initial={snap} />
}
