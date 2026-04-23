// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminClubsClient from "./AdminClubsClient"

export const dynamic = "force-dynamic"

type Club = {
  id: string
  title: string
  description: string | null
  level: string | null
  scheduled_at: string
  duration_minutes: number
  capacity: number
  registered_count: number
  host_teacher_id: string | null
  host_teacher_name: string | null
  status: "draft" | "published" | "cancelled" | "completed"
}

type TeacherOption = {
  id: string
  full_name: string
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
  clubs: Club[]
  teachers: TeacherOption[]
}> {
  const hdrs = await headers()
  const host = hdrs.get("host")
  const proto = hdrs.get("x-forwarded-proto") ?? "http"
  const cookie = hdrs.get("cookie") ?? ""
  if (!host) return { clubs: [], teachers: [] }
  const base = `${proto}://${host}`

  const [clubsRes, teacherRes] = await Promise.all([
    safeFetch(`${base}/api/admin/clubs`, cookie),
    safeFetch(`${base}/api/teachers?limit=100`, cookie),
  ])

  return {
    clubs: Array.isArray(clubsRes?.clubs) ? clubsRes.clubs : [],
    teachers: Array.isArray(teacherRes?.teachers)
      ? teacherRes.teachers.map((t: any) => ({
          id: t.id,
          full_name: t.full_name || t.name || "—",
        }))
      : [],
  }
}

export default async function AdminClubsPage() {
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
  return <AdminClubsClient initial={snap} />
}
