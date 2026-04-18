'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseLessonsRealtimeOptions {
  /**
   * teacher_profiles.id (NOT auth user id) — subscribe to lessons.teacher_id=eq.<teacherId>.
   */
  teacherId?: string | null
  /**
   * auth user id of the student — subscribe to lessons.student_id=eq.<studentId>.
   */
  studentId?: string | null
  /**
   * Called on any INSERT/UPDATE/DELETE matching the filter(s). Debounced to
   * coalesce bursts of events (e.g. cascade updates in a single transaction).
   */
  onChange: () => void
  /**
   * Debounce window in ms. Default 400ms.
   */
  debounceMs?: number
  /**
   * When false, the hook unsubscribes and does nothing. Useful to gate the
   * subscription on auth readiness or drawer open state.
   */
  enabled?: boolean
}

/**
 * Subscribe to Supabase Realtime events on public.lessons for a given
 * teacher_profile.id and/or student user_id. Calls `onChange` (debounced)
 * whenever an INSERT/UPDATE/DELETE matches.
 *
 * Requires `ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;`
 * (see migration 013_enable_realtime_lessons.sql).
 */
export function useLessonsRealtime({
  teacherId,
  studentId,
  onChange,
  debounceMs = 400,
  enabled = true,
}: UseLessonsRealtimeOptions): void {
  // Keep the latest onChange in a ref so we don't have to resubscribe whenever
  // the parent re-renders with a new closure.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled) return
    if (!teacherId && !studentId) return

    const supabase = createClient()
    const channels: RealtimeChannel[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        onChangeRef.current()
      }, debounceMs)
    }

    if (teacherId) {
      const chan = supabase
        .channel(`lessons:teacher:${teacherId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lessons',
            filter: `teacher_id=eq.${teacherId}`,
          },
          trigger
        )
        .subscribe()
      channels.push(chan)
    }

    if (studentId) {
      const chan = supabase
        .channel(`lessons:student:${studentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lessons',
            filter: `student_id=eq.${studentId}`,
          },
          trigger
        )
        .subscribe()
      channels.push(chan)
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      for (const ch of channels) {
        void supabase.removeChannel(ch)
      }
    }
  }, [teacherId, studentId, enabled, debounceMs])
}
