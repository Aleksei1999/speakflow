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
        if (Array.isArray(data)) {
          // Мержим с текущим state, чтобы не потерять optimistic-плейсхолдеры
          // отправленные во время refetch (SUBSCRIBED-reconnect).
          setMessages((prev) => {
            const seen = new Set(data.map((m) => m.id))
            const pending = prev.filter((m) => m.id.startsWith("optimistic:") && !seen.has(m.id))
            return [...data, ...pending]
          })
        }
      } catch {
        // тихо: пустой список покажется
      }
    }
    loadInitial()

    // Realtime подписка на chat_messages (общий 1:1 чат teacher↔student).
    // Фильтр по одному из участников (userId), клиент маппит и дедуп-ит по id.
    // Строки chat_messages идут в shape {teacher_id, student_id, sender_role, text}
    // — превращаем в клиентский ChatMessage {sender_id, message}.
    type ChatRow = {
      id: string
      teacher_id: string
      student_id: string
      sender_role: "teacher" | "student"
      text: string | null
      created_at: string
    }
    function rowToMsg(r: ChatRow): ChatMessage {
      return {
        id: r.id,
        sender_id: r.sender_role === "teacher" ? r.teacher_id : r.student_id,
        message: r.text ?? "",
        created_at: r.created_at,
      }
    }
    const channel: RealtimeChannel = supabase
      // Уникальный суффикс — защита от кеша supabase-js по имени
      // (StrictMode двойной mount → cleanup → «мёртвый» канал).
      .channel(`lesson-chat:${lessonId}:${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          // Фильтруем «мои треды» — student_id или teacher_id совпал.
          // postgres_changes допускает один фильтр — используем OR через
          // 2 подписки не хочется; берём eq по userId в любой роли.
          // Realtime отдаст строки, где хотя бы одна из FK равна userId.
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = rowToMsg(payload.new as ChatRow)
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `teacher_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = rowToMsg(payload.new as ChatRow)
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
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
      .subscribe((status, err) => {
        // Reconnect-safe: закрываем gap событий на (re)подписке.
        if (status === "SUBSCRIBED") loadInitial()
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("[lesson-chat] realtime status:", status, err ?? "")
        }
      })

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
