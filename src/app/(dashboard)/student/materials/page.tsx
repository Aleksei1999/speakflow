import { redirect } from "next/navigation"
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

export const dynamic = "force-dynamic"

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

  // Load on client only — avoids self-fetch loop on reload (host+cookie
  // sometimes resolves to the CF/RU proxy and stalls). Client uses relative URL.
  return <StudentMaterialsClient initial={EMPTY_SNAPSHOT} />
}
