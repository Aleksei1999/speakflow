"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { useTranslations } from "next-intl"
import { Send, FileText, StickyNote, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Tab = "chat" | "materials" | "notes"

interface LessonSidebarProps {
  lessonId: string
  userId: string
  userName: string
  teacherName: string
}

interface ChatMessage {
  id: string
  sender_id: string
  message: string
  created_at: string
}

export function LessonSidebar({
  lessonId,
  userId,
  userName,
  teacherName,
}: LessonSidebarProps) {
  const t = useTranslations("components.lesson.sidebar")
  const [tab, setTab] = useState<Tab>("chat")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [notes, setNotes] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Load chat messages.
  // Initial load — через защищённое API (auth + participant check).
  // Realtime — оставляем supabase-js: RLS на lesson_messages теперь корректная
  // (см. миграция 20260510120000), broadcast получают только участники.
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch(`/api/lesson/messages?lessonId=${encodeURIComponent(lessonId)}`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as ChatMessage[] | { error: string }
        if (Array.isArray(data)) setMessages(data)
      } catch {
        // тихо: компонент покажет пустой список
      }
    }
    loadMessages()

    const channel = supabase
      .channel(`lesson-chat-${lessonId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lesson_messages",
          filter: `lesson_id=eq.${lessonId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [lessonId, supabase])

  // Load notes — тоже через защищённое API.
  useEffect(() => {
    async function loadNotes() {
      try {
        const res = await fetch(`/api/lesson/notes?lessonId=${encodeURIComponent(lessonId)}`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as Array<{ content: string }> | { error: string }
        if (Array.isArray(data) && data.length > 0) {
          // У одного пользователя одна заметка на урок (unique key
          // lesson_id+user_id), но defensively берём последнюю.
          const last = data[data.length - 1]
          if (last?.content) setNotes(last.content)
        }
      } catch {
        // ignore
      }
    }
    loadNotes()
  }, [lessonId])

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = newMessage.trim()
    if (!text) return
    try {
      const res = await fetch("/api/lesson/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, message: text }),
      })
      if (!res.ok) return
      // Не пушим в local state — получим через realtime broadcast
      // от своего же INSERT, чтобы не было дубликата.
      setNewMessage("")
    } catch {
      // тихо: можно показать toast, но в комнате урока обычно не хочется
    }
  }, [newMessage, lessonId])

  const saveNotes = useCallback(async () => {
    try {
      await fetch("/api/lesson/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, content: notes }),
      })
    } catch {
      // ignore — следующий save попробует ещё раз
    }
  }, [notes, lessonId])

  const tabs = [
    { key: "chat" as Tab, label: t("tabChat"), icon: MessageSquare },
    { key: "materials" as Tab, label: t("tabMaterials"), icon: FileText },
    { key: "notes" as Tab, label: t("tabNotes"), icon: StickyNote },
  ]

  return (
    <div className="flex h-full flex-col bg-[#1E293B] text-white">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
              tab === item.key
                ? "border-b-2 border-[#CC3A3A] text-white"
                : "text-white/50 hover:text-white/80"
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === "chat" && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id}>
                  <div className={cn("text-xs font-medium mb-0.5", isMe ? "text-[#DFED8C]" : "text-[#CC3A3A]")}>
                    {isMe ? t("you") : teacherName}
                  </div>
                  <div className="text-sm text-white/90 leading-relaxed">
                    {msg.message}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={t("chatPlaceholder")}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#CC3A3A]"
            />
            <button
              onClick={sendMessage}
              className="flex size-9 items-center justify-center rounded-lg bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Materials Tab */}
      {tab === "materials" && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-center text-sm text-white/40 py-8">
            {t("materialsEmpty")}
          </p>
        </div>
      )}

      {/* Notes Tab */}
      {tab === "notes" && (
        <div className="flex flex-1 flex-col">
          <div className="flex-1 p-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder={t("notesPlaceholder")}
              className="h-full w-full resize-none rounded-lg bg-white/10 p-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#CC3A3A]"
            />
          </div>
          <div className="border-t border-white/10 p-3">
            <button
              onClick={saveNotes}
              className="w-full rounded-lg bg-white/10 py-2 text-xs text-white/70 hover:bg-white/20"
            >
              {t("notesSave")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
