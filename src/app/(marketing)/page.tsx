import type { Metadata } from "next"
import LandingClient from "./_landing/LandingClient"

export const metadata: Metadata = {
  title: "RAW English — Make It Well Done",
  description:
    "EdTech-платформа с геймификацией: XP, стрики, 37 ачивок, speaking clubs и уроки 1-on-1. Прожарь свой английский от Raw до Well Done.",
}

export default function Home() {
  return <LandingClient />
}
