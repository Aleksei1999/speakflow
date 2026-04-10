"use client"

import Link from "next/link"

export function StickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] md:hidden">
      <Link
        href="/get-started"
        className="flex w-full items-center justify-center rounded-xl bg-[#CC3A3A] py-3.5 text-sm font-semibold text-white hover:bg-[#a32e2e]"
      >
        Тест уровня — бесплатно
      </Link>
    </div>
  )
}
