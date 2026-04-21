"use client"

import { useState } from "react"
import { BookingDrawer } from "@/components/booking/booking-drawer"

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
      <BookingDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}
