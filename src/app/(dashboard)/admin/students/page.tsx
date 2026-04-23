// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminStudentsClient from "./AdminStudentsClient"

export const dynamic = "force-dynamic"

type Student = {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
  level: string | null
  goal: string | null
  total_xp: number
  current_streak: number
  lessons_count: number
  last_lesson_at: string | null
  created_at: string
  is_active: boolean
}

async function loadStudents(): Promise<Student[]> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    const cookie = hdrs.get("cookie") ?? ""
    if (!host) return []
    const res = await fetch(
      `${proto}://${host}/api/admin/students?limit=100&sort=recent`,
      { headers: { cookie }, cache: "no-store" }
    )
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json.students) ? json.students : []
  } catch {
    return []
  }
}

export default async function AdminStudentsPage() {
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

  const students = await loadStudents()
  return <AdminStudentsClient initial={students} />
}
