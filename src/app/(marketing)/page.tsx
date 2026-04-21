// @ts-nocheck
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import LandingClient from "./_landing/LandingClient"

export const metadata: Metadata = {
  title: "RAW English — Make It Well Done",
  description:
    "EdTech-платформа с геймификацией: XP, стрики, 37 ачивок, speaking clubs и уроки 1-on-1. Прожарь свой английский от Raw до Well Done.",
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let homeHref = "/student"
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    const role = profile?.role
    if (role === "admin") homeHref = "/admin"
    else if (role === "teacher") homeHref = "/teacher"
    else homeHref = "/student"
  }

  return <LandingClient isAuthenticated={!!user} homeHref={homeHref} />
}
