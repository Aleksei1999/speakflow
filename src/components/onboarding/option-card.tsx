"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface OptionCardProps {
  icon: ReactNode
  label: string
  sublabel?: string
  selected: boolean
  onClick: () => void
}

export function OptionCard({
  icon,
  label,
  sublabel,
  selected,
  onClick,
}: OptionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC3A3A] focus-visible:ring-offset-2",
        selected
          ? "border-[#CC3A3A] bg-[#FFF0F0]"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      )}
      aria-pressed={selected}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-[#CC3A3A]/10 text-[#CC3A3A]" : "bg-gray-100 text-gray-600"
        )}
      >
        {icon}
      </span>

      <span className="flex flex-1 flex-col">
        <span className="text-base font-medium text-[#1E1E1E]">{label}</span>
        {sublabel && (
          <span className="text-sm text-gray-500">{sublabel}</span>
        )}
      </span>

      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-[#CC3A3A]" : "border-gray-300"
        )}
      >
        {selected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-2.5 w-2.5 rounded-full bg-[#CC3A3A]"
          />
        )}
      </span>
    </motion.button>
  )
}
