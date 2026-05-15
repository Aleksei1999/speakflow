"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

// LessonBookingModal — ~800 строк + supabase realtime канал. На dashboard
// открывается только по клику на CTA — ленивая загрузка экономит initial JS.
const LessonBookingModal = dynamic(
  () => import("@/components/booking/lesson-booking-modal").then((m) => m.LessonBookingModal),
  { ssr: false, loading: () => null },
)

type Props = {
  className?: string
  children: React.ReactNode
}

export function BookingLauncher({ className, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? <LessonBookingModal open={open} onOpenChange={setOpen} /> : null}
    </>
  )
}
