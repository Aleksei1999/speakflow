// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import TeacherClubsClient from "./TeacherClubsClient"

export const dynamic = "force-dynamic"

async function loadClubs(): Promise<{ clubs: any[]; unread_count: number }> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    const cookie = hdrs.get("cookie") ?? ""
    if (!host) return { clubs: [], unread_count: 0 }
    const res = await fetch(`${proto}://${host}/api/teacher/clubs`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return { clubs: [], unread_count: 0 }
    const json = await res.json()
    return {
      clubs: Array.isArray(json?.clubs) ? json.clubs : [],
      unread_count: typeof json?.unread_count === "number" ? json.unread_count : 0,
    }
  } catch {
    return { clubs: [], unread_count: 0 }
  }
}

export default async function TeacherClubsPage() {
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
  if (profile.role === "admin") redirect("/admin")
  if (profile.role !== "teacher") redirect("/login")

  const initial = await loadClubs()
  return <TeacherClubsClient initial={initial} />
}
