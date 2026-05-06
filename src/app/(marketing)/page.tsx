// @ts-nocheck
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LandingClient from "./_landing/LandingClient"

export const metadata: Metadata = {
  title: "RAW English — Make It Well Done",
  description:
    "EdTech-платформа с геймификацией: XP, стрики, 37 ачивок, speaking clubs и уроки 1-on-1. Прожарь свой английский от Raw до Well Done.",
}

// Серверный auth-check — нужен динамический рендер. Без force-dynamic
// Next бы кэшировал HTML и редирект для логиненных не сработал.
export const dynamic = "force-dynamic"

export default async function Home() {
  // Залогиненный юзер кликает на лого / открывает / — мгновенно
  // отправляем в его дашборд, без мерцания landing-XP overlay.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    const role = profile?.role
    if (role === "admin") redirect("/admin")
    if (role === "teacher") redirect("/teacher")
    redirect("/student")
  }

  return <LandingClient />
}
