import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import StudentMaterialsClient from "./StudentMaterialsClient"

type InitialSnapshot = {
  materials: any[]
  counts: Record<string, number>
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  materials: [],
  counts: {
    all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0,
    "A1-A2": 0, B1: 0, B2: 0, "C1+": 0,
  },
}

async function loadInitialSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(`${proto}://${host}/api/student/materials?type=all&level=all&sort=recent`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      materials: Array.isArray(json.materials) ? json.materials : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export default async function StudentMaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any).from("profiles").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "student") {
    if (profile?.role === "teacher") redirect("/teacher")
    if (profile?.role === "admin") redirect("/admin")
    redirect("/login")
  }

  const snap = await loadInitialSnapshot()

  return <StudentMaterialsClient initial={snap} />
}
