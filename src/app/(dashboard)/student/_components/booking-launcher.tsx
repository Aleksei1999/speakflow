"use client"

import { useState } from "react"
import { LessonBookingModal } from "@/components/booking/lesson-booking-modal"

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
      <LessonBookingModal open={open} onOpenChange={setOpen} />
    </>
  )
}
