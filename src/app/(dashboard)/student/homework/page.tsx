// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import StudentHomeworkClient from "./StudentHomeworkClient"

export const dynamic = "force-dynamic"

type InitialSnapshot = {
  homework: any[]
  counts: { all: number; todo: number; submitted: number; reviewed: number }
  stats: {
    xp_this_month: number
    reviewed_lifetime: number
    waiting: number
    in_review: number
  }
  urgent: any | null
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  homework: [],
  counts: { all: 0, todo: 0, submitted: 0, reviewed: 0 },
  stats: { xp_this_month: 0, reviewed_lifetime: 0, waiting: 0, in_review: 0 },
  urgent: null,
}

async function loadSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(
      `${proto}://${host}/api/student/homework?filter=all&sort=due_soon`,
      { headers: { cookie }, cache: "no-store" }
    )
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      homework: Array.isArray(json.homework) ? json.homework : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
      stats: { ...EMPTY_SNAPSHOT.stats, ...(json.stats ?? {}) },
      urgent: json.urgent ?? null,
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export default async function StudentHomeworkPage() {
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
  if (!profile || profile.role !== "student") {
    if (profile?.role === "teacher") redirect("/teacher")
    if (profile?.role === "admin") redirect("/admin")
    redirect("/login")
  }

  const snap = await loadSnapshot()
  return <StudentHomeworkClient initial={snap} />
}
