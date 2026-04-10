"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function Preloader() {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 1200)
    const remove = setTimeout(() => setVisible(false), 1800)
    return () => {
      clearTimeout(timer)
      clearTimeout(remove)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500",
        fadeOut ? "opacity-0" : "opacity-100"
      )}
    >
      <div className="preloader-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-raw-full.svg"
          alt="RAW English"
          className="h-16 w-auto animate-preloader"
        />
      </div>
    </div>
  )
}
