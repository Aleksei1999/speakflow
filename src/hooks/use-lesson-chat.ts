"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface ChatMessage {
  id: string
  sender_id: string
  message: string
  created_at: string
}

interface UseLessonChatOptions {
  lessonId: string
  userId: string
  /**
   * Когда true — sendMessage сразу добавляет сообщение в state с временным
   * id `optimistic:<rand>`. После прихода реального INSERT через realtime
   * плейсхолдер заменяется на серверный объект.
   */
  optimistic?: boolean
}

interface UseLessonChatResult {
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
}

/**
 * Чат урока с Supabase Realtime. Initial fetch через защищённый API,
 * live updates по postgres_changes INSERT на lesson_messages,
 * sendMessage с optimistic UI.
 */
export function useLessonChat({
  lessonId,
  userId,
  optimistic = true,
}: UseLessonChatOptions): UseLessonChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // text -> optimistic id; в ref чтобы подписка не ре-рендерилась.
  const pendingRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!lessonId) return
    let cancelled = false
    const supabase = createClient()

    async function loadInitial() {
      try {
        const res = await fetch(
          `/api/lesson/messages?lessonId=${encodeURIComponent(lessonId)}`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const data = (await res.json()) as ChatMessage[] | { error: string }
        if (cancelled) return
        if (Array.isArray(data)) setMessages(data)
      } catch {
        // тихо: пустой список покажется
      }
    }
    loadInitial()

    const channel: RealtimeChannel = supabase
      .channel(`lesson-chat:${lessonId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lesson_messages",
          filter: `lesson_id=eq.${lessonId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage
          setMessages((prev) => {
            // Дедуп по id (гонка initial-load vs realtime).
            if (prev.some((m) => m.id === incoming.id)) return prev
            // Наш собственный INSERT — заменяем оптимистичный плейсхолдер.
            if (incoming.sender_id === userId) {
              const optimisticId = pendingRef.current.get(incoming.message)
              if (optimisticId) {
                pendingRef.current.delete(incoming.message)
                return prev.map((m) => (m.id === optimisticId ? incoming : m))
              }
            }
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [lessonId, userId])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      let optimisticId: string | null = null
      if (optimistic) {
        optimisticId = `optimistic:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
        pendingRef.current.set(trimmed, optimisticId)
        setMessages((prev) => [
          ...prev,
          {
            id: optimisticId!,
            sender_id: userId,
            message: trimmed,
            created_at: new Date().toISOString(),
          },
        ])
      }

      try {
        const res = await fetch("/api/lesson/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, message: trimmed }),
        })
        if (!res.ok) {
          // Откатываем оптимистичный плейсхолдер при ошибке.
          if (optimisticId) {
            pendingRef.current.delete(trimmed)
            const failedId = optimisticId
            setMessages((prev) => prev.filter((m) => m.id !== failedId))
          }
        }
        // На успехе ничего не делаем: realtime сам заменит плейсхолдер.
      } catch {
        if (optimisticId) {
          pendingRef.current.delete(trimmed)
          const failedId = optimisticId
          setMessages((prev) => prev.filter((m) => m.id !== failedId))
        }
      }
    },
    [lessonId, userId, optimistic]
  )

  return { messages, sendMessage }
}
