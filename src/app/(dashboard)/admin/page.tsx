// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import AdminHomeClient from "./AdminHomeClient"

export const dynamic = "force-dynamic"

type AdminStats = {
  students_active: number
  students_delta_week: number
  apps_today: number
  apps_delta_day: number
  lessons_today: number
  live_now: number
  open_tickets: number
  tickets_urgent: number
  signups_week: number[]
  signups_total: number
  conversion_trial: number
  conversion_paid: number
}

type TrialRequest = {
  id: string
  student_name: string
  level: string | null
  goal: string | null
  preferred_slot: string | null
  status: "new" | "processing" | "matched" | "done" | "cancelled"
  created_at: string
  notes: string | null
  assigned_teacher_id: string | null
}

type SupportThread = {
  id: string
  subject: string
  student_name: string
  student_level: string | null
  priority: "low" | "medium" | "high"
  status: "open" | "pending" | "resolved" | "closed"
  last_message_at: string
  created_at: string
}

type RecentStudent = {
  id: string
  full_name: string
  level: string | null
  goal: string | null
  created_at: string
}

const EMPTY_STATS: AdminStats = {
  students_active: 0,
  students_delta_week: 0,
  apps_today: 0,
  apps_delta_day: 0,
  lessons_today: 0,
  live_now: 0,
  open_tickets: 0,
  tickets_urgent: 0,
  signups_week: [0, 0, 0, 0, 0, 0, 0],
  signups_total: 0,
  conversion_trial: 0,
  conversion_paid: 0,
}

async function safeFetch(url: string, cookie: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { cookie }, cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function loadSnapshot(): Promise<{
  stats: AdminStats
  requests: TrialRequest[]
  tickets: SupportThread[]
  students: RecentStudent[]
}> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    const cookie = hdrs.get("cookie") ?? ""
    if (!host) {
      return {
        stats: EMPTY_STATS,
        requests: [],
        tickets: [],
        students: [],
      }
    }
    const base = `${proto}://${host}`

    const [statsRes, reqRes, ticketsRes, studentsRes] = await Promise.all([
      safeFetch(`${base}/api/admin/stats`, cookie),
      safeFetch(`${base}/api/admin/trial-requests?limit=5`, cookie),
      safeFetch(`${base}/api/support/threads?limit=5&admin=1`, cookie),
      safeFetch(`${base}/api/admin/students?limit=5&sort=recent`, cookie),
    ])

    return {
      stats: { ...EMPTY_STATS, ...(statsRes ?? {}) },
      requests: Array.isArray(reqRes?.requests) ? reqRes.requests : [],
      tickets: Array.isArray(ticketsRes?.threads) ? ticketsRes.threads : [],
      students: Array.isArray(studentsRes?.students) ? studentsRes.students : [],
    }
  } catch {
    return {
      stats: EMPTY_STATS,
      requests: [],
      tickets: [],
      students: [],
    }
  }
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")
  if (profile.role === "student") redirect("/student")
  if (profile.role === "teacher") redirect("/teacher")
  if (profile.role !== "admin") redirect("/login")

  const snap = await loadSnapshot()

  return (
    <AdminHomeClient
      fullName={profile.full_name ?? "Администратор"}
      initial={snap}
    />
  )
}
