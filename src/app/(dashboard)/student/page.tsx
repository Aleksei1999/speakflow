// @ts-nocheck
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date()

  const [profileResult, lessonsResult, progressResult, completedResult, skillsResult, homeworkResult] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id")
        .eq("student_id", user.id)
        .eq("status", "booked")
        .gte("scheduled_at", now.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5),
      supabase.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .eq("status", "completed"),
      supabase.from("skill_progress").select("*").eq("user_id", user.id),
      supabase
        .from("homework")
        .select("id, title, due_date, status, teacher_id")
        .eq("student_id", user.id)
        .order("due_date", { ascending: true })
        .limit(5),
    ])

  const profile = profileResult.data
  const lessons = lessonsResult.data ?? []
  const progress = progressResult.data
  const completedCount = completedResult.count ?? 0
  const skills = skillsResult?.data ?? []
  const homework = homeworkResult?.data ?? []
  const firstName = profile?.full_name?.split(" ")[0] ?? "Ученик"
  const fullName = profile?.full_name ?? "Ученик"
  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const skillMap: Record<string, number> = {}
  for (const s of skills) skillMap[s.skill] = s.percentage
  const totalHours = Math.round((completedCount * 50) / 60)

  return (
    <>
      <header className="header">
        <h1>Привет, {firstName}!</h1>
        <div className="user-profile">
          <span>{fullName}</span>
          <div className="avatar">{initials}</div>
        </div>
      </header>

      {/* Stats */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-num">{completedCount}/48</span>
          <span className="stat-desc">Пройдено уроков</span>
        </div>
        <div className="stat-card dark">
          <span className="stat-num">{homework.filter((h) => h.status === "submitted" || h.status === "reviewed").length}/{homework.length || 0}</span>
          <span className="stat-desc">Сдано домашних заданий</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-num">{progress?.total_xp ?? 0}</span>
          <span className="stat-desc">XP баллов</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{progress?.english_level ?? "—"}</span>
          <span className="stat-desc">Текущий уровень</span>
        </div>
      </section>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Upcoming Lessons */}
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">Ближайшие уроки</h3>
            <Link href="/student/schedule" style={{ color: "var(--gray-text)", fontSize: 14 }}>Смотреть все</Link>
          </div>

          {lessons.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--gray-text)", padding: "40px 0" }}>
              Нет запланированных уроков
            </p>
          ) : (
            lessons.map((l, i) => {
              const date = new Date(l.scheduled_at)
              const isToday = date.toDateString() === now.toDateString()
              const dayNum = format(date, "d")
              const timeStr = format(date, "HH:mm")

              return (
                <div key={l.id} className="lesson-row">
                  <div
                    className="time-badge"
                    style={i > 0 ? { background: "var(--gray-light)", color: "var(--black)" } : {}}
                  >
                    <span>{dayNum}</span>
                    <small>{timeStr}</small>
                  </div>
                  <div className="lesson-info" style={{ flex: 1 }}>
                    <h4>Урок английского</h4>
                    <p>{l.duration_minutes} мин • {isToday ? "Сегодня" : format(date, "d MMM", { locale: ru })}</p>
                  </div>
                  {isToday ? (
                    <Link href={`/student/lesson/${l.id}`} className="btn btn-black">Войти</Link>
                  ) : (
                    <button className="btn btn-outline">Перенести</button>
                  )}
                </div>
              )
            })
          )}
        </section>

        {/* Progress */}
        <section className="card">
          <h3 className="card-title" style={{ marginBottom: 35 }}>Прогресс до B2</h3>

          {[
            { key: "grammar", label: "Грамматика" },
            { key: "vocabulary", label: "Лексика" },
            { key: "speaking", label: "Говорение" },
          ].map((skill, i) => {
            const pct = skillMap[skill.key] ?? 0
            return (
              <div key={skill.key} className="progress-item">
                <div className="progress-labels">
                  <span>{skill.label}</span>
                  <span>{pct}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${pct}%`,
                      ...(i === 2 ? { background: "var(--accent)" } : {}),
                    }}
                  />
                </div>
              </div>
            )
          })}
        </section>
      </div>

      {/* Homework */}
      <section className="card" style={{ marginTop: 30 }}>
        <div className="card-header">
          <h3 className="card-title">Актуальные задания</h3>
        </div>
        {homework.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--gray-text)", padding: "30px 0" }}>
            Заданий пока нет
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--gray-text)", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ paddingBottom: 20 }}>Задание</th>
                <th style={{ paddingBottom: 20 }}>Преподаватель</th>
                <th style={{ paddingBottom: 20 }}>Срок</th>
                <th style={{ paddingBottom: 20 }}>Статус</th>
                <th style={{ paddingBottom: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {homework.map((hw: any) => {
                const statusStyles: Record<string, { bg: string; label: string }> = {
                  pending: { bg: "var(--gray-light)", label: "Ожидает" },
                  in_progress: { bg: "var(--accent)", label: "В работе" },
                  submitted: { bg: "#D1FAE5", label: "Сдано" },
                  reviewed: { bg: "#D1FAE5", label: "Проверено" },
                  overdue: { bg: "#FEE2E2", label: "Просрочено" },
                }
                const st = statusStyles[hw.status] ?? statusStyles.pending
                return (
                  <tr key={hw.id} style={{ borderTop: "1px solid var(--gray-light)" }}>
                    <td style={{ padding: "20px 0" }}><strong>{hw.title}</strong></td>
                    <td>Преподаватель</td>
                    <td>{format(new Date(hw.due_date), "d MMMM", { locale: ru })}</td>
                    <td>
                      <span style={{ background: st.bg, padding: "5px 12px", borderRadius: 10, fontSize: 12 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-outline" style={{ padding: "8px 15px" }}>Открыть</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
