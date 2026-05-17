"use client"
// MarkCategorySeen — drop-in client island for any dashboard page that
// should mark its sidebar badge as seen on mount.
//
// Usage (in server page.tsx):
//   import { MarkCategorySeen } from "@/components/dashboard/mark-category-seen"
//   <MarkCategorySeen category="schedule" />
//
// Internals: just calls markCategorySeen(category) once per mount.
// We intentionally do NOT depend on pathname/route changes — re-mounting
// the page (e.g. after a real navigation) is the trigger. Fast paths
// (same page re-render via Server Action) are deliberately a no-op so
// we don't spam the API.

import { useEffect, useRef } from "react"
import { markCategorySeen, type UnreadCategory } from "@/hooks/use-unread-badges"

export function MarkCategorySeen({ category }: { category: UnreadCategory }) {
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    // Defer slightly so we don't compete with the page's primary fetches.
    const id = setTimeout(() => {
      void markCategorySeen(category)
    }, 250)
    return () => clearTimeout(id)
  }, [category])
  return null
}
