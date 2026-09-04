"use client"

// Простой календарь ученика: список ближайших уроков + кнопка «добавить урок»
// (открывает ту же StudentAddLessonModal). Пока без grid-view — для MVP.

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import StudentAddLessonModal from "@/components/student/StudentAddLessonModal"

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

interface Lesson {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: string
  teacherName: string | null
}

interface Props {
  studentId: string
  initialLessons: Lesson[]
}

export default function StudentSchedulePage({ studentId, initialLessons }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1E1E1E",
      color: "#F5E6DB",
      fontFamily: "Inter, sans-serif",
      padding: "40px 24px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <Link href="/student" style={{ color: "#DFED8C", textDecoration: "none", fontSize: 14 }}>
            ← Дашборд
          </Link>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              background: "#CC3A3A",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "12px 28px",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            добавить урок
          </button>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 24px" }}>Календарь</h1>

        {initialLessons.length === 0 ? (
          <div style={{
            padding: 40,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 24,
            textAlign: "center",
            color: "rgba(245,230,219,0.7)",
          }}>
            Пока нет запланированных уроков.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {initialLessons.map((l) => (
              <div key={l.id} style={{
                padding: "18px 24px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{formatWhen(l.scheduledAt)}</div>
                  <div style={{ fontSize: 14, color: "rgba(245,230,219,0.7)", marginTop: 4 }}>
                    {l.teacherName ? `урок с ${l.teacherName}` : "Урок"} · {l.durationMinutes} мин
                  </div>
                </div>
                <span style={{
                  padding: "6px 14px",
                  background: l.status === "booked" ? "#DFED8C" : "rgba(255,255,255,0.1)",
                  color: l.status === "booked" ? "#1E1E1E" : "rgba(245,230,219,0.7)",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                }}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <StudentAddLessonModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => router.refresh()}
      />
    </div>
  )
}
