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
  const fullName = profile?.full_name ?? "Ученик"
  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  const skillMap: Record<string, number> = {}
  for (const s of skills) skillMap[s.skill] = s.percentage
  const totalHours = Math.round((completedCount * 50) / 60)

  // Calendar
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lessonDays = new Set(lessons.map((l) => new Date(l.scheduled_at).getDate()))

  // Previous month days for filling
  const prevMonthDays = new Date(year, month, 0).getDate()

  return (
    <>
      <div className="dashboard-header">
        <h1>Добро пожаловать, {fullName.split(" ")[0]}!</h1>
        <div className="user-menu">
          <div className="notifications">
            🔔
            <span className="badge">3</span>
          </div>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Пройдено уроков</div>
          <div className="value">{completedCount}</div>
          <div className="change positive">+{progress?.current_streak ?? 0} на этой неделе</div>
        </div>
        <div className="stat-card">
          <div className="label">Часов обучения</div>
          <div className="value">{totalHours}</div>
          <div className="change positive">На этой неделе</div>
        </div>
        <div className="stat-card">
          <div className="label">Текущий уровень</div>
          <div className="value">{progress?.english_level ?? "—"}</div>
          <div className="change">{progress?.english_level ?? "Пройдите тест"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Баланс</div>
          <div className="value">{progress?.total_xp ?? 0} XP</div>
          <div className="change">≈ {Math.floor((progress?.total_xp ?? 0) / 100)} уроков</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Upcoming Lessons */}
        <div className="card">
          <div className="card-header">
            <h3>Ближайшие уроки</h3>
            <Link href="/student/schedule" className="btn btn-sm btn-secondary">Все уроки</Link>
          </div>
          <div className="card-body">
            {lessons.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-gray)", padding: "32px 0" }}>
                Нет запланированных уроков
              </p>
            ) : (
              lessons.map((l) => {
                const date = new Date(l.scheduled_at)
                const isToday = date.toDateString() === now.toDateString()
                const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()
                const dayLabel = isToday ? "Сегодня" : isTomorrow ? "Завтра" : format(date, "EE, d MMM", { locale: ru })

                return (
                  <div key={l.id} className="schedule-item">
                    <div className="schedule-time">
                      <div className="time">{format(date, "HH:mm")}</div>
                      <div className="date">{dayLabel}</div>
                    </div>
                    <div className="schedule-info">
                      <h4>Урок английского</h4>
                      <p>{l.duration_minutes} мин</p>
                    </div>
                    <div className="schedule-actions">
                      {isToday ? (
                        <Link href={`/student/lesson/${l.id}`} className="btn btn-primary btn-sm">Войти</Link>
                      ) : (
                        <button className="btn btn-secondary btn-sm">Перенести</button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Progress & Calendar */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>Прогресс до B2</h3>
            </div>
            <div className="card-body">
              {[
                { key: "grammar", label: "Грамматика" },
                { key: "vocabulary", label: "Лексика" },
                { key: "speaking", label: "Говорение" },
                { key: "listening", label: "Аудирование" },
              ].map((skill, idx, arr) => {
                const pct = skillMap[skill.key] ?? 0
                return (
                  <div key={skill.key} style={{ marginBottom: idx < arr.length - 1 ? 16 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span>{skill.label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>{format(now, "LLLL yyyy", { locale: ru })}</h3>
            </div>
            <div className="card-body">
              <div className="calendar-header">
                <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
              </div>
              <div className="calendar">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`p-${i}`} className="calendar-day other-month">{prevMonthDays - firstDow + i + 1}</div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === now.getDate()
                  const hasLesson = lessonDays.has(day)
                  const cls = ["calendar-day", isToday && "today", hasLesson && "has-event"].filter(Boolean).join(" ")
                  return <div key={day} className={cls}>{day}</div>
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Homework */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Домашние задания</h3>
          <button className="btn btn-sm btn-secondary">Все задания</button>
        </div>
        <div className="card-body">
          {homework.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-gray)", padding: "32px 0" }}>
              Домашних заданий пока нет
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Задание</th>
                  <th>Преподаватель</th>
                  <th>Срок сдачи</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {homework.map((hw: any) => {
                  const statusCls = hw.status === "submitted" || hw.status === "reviewed"
                    ? "status-success" : hw.status === "overdue" ? "status-danger" : "status-pending"
                  const statusLabel = { pending: "В работе", in_progress: "В работе", submitted: "Сдано", reviewed: "Проверено", overdue: "Просрочено" }[hw.status] ?? hw.status
                  return (
                    <tr key={hw.id}>
                      <td><strong>{hw.title}</strong></td>
                      <td>Преподаватель</td>
                      <td>{format(new Date(hw.due_date), "d MMMM", { locale: ru })}</td>
                      <td><span className={`status ${statusCls}`}>{statusLabel}</span></td>
                      <td><button className="btn btn-sm btn-primary">Открыть</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
