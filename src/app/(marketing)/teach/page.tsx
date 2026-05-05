// @ts-nocheck
import type { Metadata } from "next"
import TeachClient from "./_client"

export const metadata: Metadata = {
  title: "Преподавай в Raw English — свобода, поток учеников, 80% от урока",
  description:
    "Платформа для преподавателей английского: свой график и цены, готовый поток учеников, выплаты 1 и 15 числа, готовая библиотека материалов.",
}

// Pure marketing landing — content changes rarely. Regenerate at most once per day.
export const revalidate = 86400

export default function TeachPage() {
  return <TeachClient />
}
