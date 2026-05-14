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
   * id `optimistic:<rand>`, чтобы UI не ждал ответа сервера. Когда из realtime
   * прилетает реальный INSERT с тем же текстом от того же sender_id —
   * оптимистичный плейсхолдер заменяется на серверный объект.
   */
  optimistic?: boolean
}

interface UseLessonChatResult {
  messages: ChatMessage[]
  sendMessage: (text: string) => Promise<void>
}

/**
 * Hook: чат урока с Supabase Realtime вместо polling.
 *
 * - Initial fetch: один запрос GET /api/lesson/messages?lessonId=...
 *   (через защищённый API endpoint — auth + participant check).
 * - Live updates: подписка на `postgres_changes` INSERT по таблице
 *   public.lesson_messages с фильтром `lesson_id=eq.<lessonId>`.
 *   RLS у таблицы корректно отфильтрует — broadcast получат только
 *   участники урока (см. миграция 20260510120000_lesson_chat_rls_fix).
 * - sendMessage: POST /api/lesson/messages с optimistic UI; realtime
 *   broadcast по своему же INSERT заменяет временный объект на серверный.
 *
 * Раньше vehicle (3 сек polling) генерировал ~1200 fetch'ей за 60-минутный
 * урок и тянул весь чат целиком на каждый ответ. Realtime даёт O(1)
 * сообщение на событие.
 */
export function useLessonChat({
  lessonId,
  userId,
  optimistic = true,
}: UseLessonChatOptions): UseLessonChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Идентификаторы наших оптимистичных сообщений, ждущих server-confirm.
  // Используем ref, чтобы не триггерить лишние ре-рендеры подписки.
  const pendingRef = useRef<Map<string, string>>(new Map()) // text -> optimistic id

  // Initial load + Realtime subscription.
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
            // Дедуп по id (на случай гонки initial-load vs realtime).
            if (prev.some((m) => m.id === incoming.id)) return prev
            // Если это наш собственный INSERT — заменим оптимистичный
            // плейсхолдер вместо добавления второго пузыря.
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
          // Откатим оптимистичный плейсхолдер при ошибке.
          if (optimisticId) {
            pendingRef.current.delete(trimmed)
            const failedId = optimisticId
            setMessages((prev) => prev.filter((m) => m.id !== failedId))
          }
        }
        // Успех: ничего не делаем. Realtime-broadcast заменит плейсхолдер.
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
