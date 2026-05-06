// @ts-nocheck
import type { Metadata } from "next"
import LandingClient from "./_landing/LandingClient"

export const metadata: Metadata = {
  title: "RAW English — Make It Well Done",
  description:
    "EdTech-платформа с геймификацией: XP, стрики, 37 ачивок, speaking clubs и уроки 1-on-1. Прожарь свой английский от Raw до Well Done.",
}

// Make homepage statically generated, revalidated hourly so Vercel can cache it on the edge.
// Auth state is resolved on the client via useUser() inside LandingClient — see CTA logic there.
export const revalidate = 3600

export default function Home() {
  return <LandingClient />
}
