"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
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
  const [tab, setTab] = useState<Tab>("chat")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [notes, setNotes] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Load chat messages
  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from("lesson_messages")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true })
      if (data) setMessages(data)
    }
    loadMessages()

    // Subscribe to realtime
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
  }, [lessonId])

  // Load notes
  useEffect(() => {
    async function loadNotes() {
      const { data } = await supabase
        .from("lesson_notes")
        .select("content")
        .eq("lesson_id", lessonId)
        .eq("user_id", userId)
        .maybeSingle()
      if (data) setNotes((data as any).content)
    }
    loadNotes()
  }, [lessonId, userId])

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim()) return
    await (supabase.from("lesson_messages") as any).insert({
      lesson_id: lessonId,
      sender_id: userId,
      message: newMessage.trim(),
    })
    setNewMessage("")
  }, [newMessage, lessonId, userId])

  const saveNotes = useCallback(async () => {
    await (supabase.from("lesson_notes") as any).upsert(
      { lesson_id: lessonId, user_id: userId, content: notes },
      { onConflict: "lesson_id,user_id" }
    )
  }, [notes, lessonId, userId])

  const tabs = [
    { key: "chat" as Tab, label: "Чат", icon: MessageSquare },
    { key: "materials" as Tab, label: "Материалы", icon: FileText },
    { key: "notes" as Tab, label: "Заметки", icon: StickyNote },
  ]

  return (
    <div className="flex h-full flex-col bg-[#1E293B] text-white">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-[#CC3A3A] text-white"
                : "text-white/50 hover:text-white/80"
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
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
                    {isMe ? "Вы" : teacherName}
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
              placeholder="Написать сообщение..."
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
            Материалы урока появятся здесь
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
              placeholder="Ваши заметки по уроку..."
              className="h-full w-full resize-none rounded-lg bg-white/10 p-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#CC3A3A]"
            />
          </div>
          <div className="border-t border-white/10 p-3">
            <button
              onClick={saveNotes}
              className="w-full rounded-lg bg-white/10 py-2 text-xs text-white/70 hover:bg-white/20"
            >
              Сохранить заметки
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
