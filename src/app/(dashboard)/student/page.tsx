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

  const skillMap: Record<string, number> = {}
  for (const s of skills) skillMap[s.skill] = s.percentage
  const totalHours = Math.round((completedCount * 50) / 60)

  // Calendar
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lessonDays = new Set(lessons.map((l) => new Date(l.scheduled_at).getDate()))

  return (
    <>
      <style>{`
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
        .stat-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .stat-card .label { font-size: 14px; color: #64748B; margin-bottom: 4px; }
        .stat-card .value { font-size: 32px; font-weight: 700; color: #CC3A3A; }
        .stat-card .change { font-size: 12px; margin-top: 4px; }
        .stat-card .change.positive { color: #10B981; }

        .dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
        .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .card-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #E2E8F0; }
        .card-header h3 { font-size: 16px; font-weight: 700; }
        .card-body { padding: 24px; }

        .schedule-item { display: flex; align-items: center; padding: 16px 0; border-bottom: 1px solid #E2E8F0; gap: 16px; }
        .schedule-item:last-child { border-bottom: none; }
        .schedule-time { text-align: center; min-width: 70px; }
        .schedule-time .time { font-size: 18px; font-weight: 700; }
        .schedule-time .date { font-size: 12px; color: #64748B; }
        .schedule-info { flex: 1; }
        .schedule-info h4 { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
        .schedule-info p { font-size: 13px; color: #64748B; }

        .progress-bar { height: 8px; background: #E2E8F0; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #CC3A3A, #DFED8C); border-radius: 4px; transition: width 0.5s; }

        .calendar-header { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 8px; }
        .calendar-header span { font-size: 12px; font-weight: 600; color: #64748B; padding: 4px; }
        .calendar { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; gap: 2px; }
        .calendar-day { padding: 8px 4px; font-size: 13px; border-radius: 8px; cursor: default; }
        .calendar-day.other-month { color: #CBD5E1; }
        .calendar-day.today { background: #CC3A3A; color: white; font-weight: 700; border-radius: 8px; }
        .calendar-day.has-event { background: #DFED8C40; font-weight: 600; }
        .calendar-day.today.has-event { background: #CC3A3A; color: white; }

        .table { width: 100%; border-collapse: collapse; }
        .table th { text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; color: #64748B; padding: 8px 12px; border-bottom: 2px solid #E2E8F0; }
        .table td { padding: 12px; border-bottom: 1px solid #E2E8F0; font-size: 14px; }
        .table tbody tr:hover { background: #F8FAFC; }

        .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .status-success { background: #D1FAE5; color: #059669; }
        .status-pending { background: #FEF3C7; color: #D97706; }
        .status-danger { background: #FEE2E2; color: #DC2626; }

        .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: #CC3A3A; color: white; }
        .btn-primary:hover { background: #a32e2e; }
        .btn-secondary { background: white; color: #1E293B; border: 1px solid #E2E8F0; }
        .btn-secondary:hover { background: #F8FAFC; }
        .btn-sm { padding: 6px 12px; font-size: 13px; }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dashboard-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dashboard-header" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Добро пожаловать, {fullName}!</h1>
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
          <div className="change">{progress?.english_level ? "Intermediate" : "Пройдите тест"}</div>
        </div>
        <div className="stat-card">
          <div className="label">Баланс</div>
          <div className="value">{progress?.total_xp ?? 0} XP</div>
          <div className="change">Уровень {progress?.current_level ?? 1}</div>
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
              <p style={{ textAlign: "center", color: "#64748B", padding: "32px 0" }}>
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
              <h3>Прогресс до {progress?.english_level === "B2" ? "C1" : "B2"}</h3>
            </div>
            <div className="card-body">
              {[
                { key: "grammar", label: "Грамматика" },
                { key: "vocabulary", label: "Лексика" },
                { key: "speaking", label: "Говорение" },
                { key: "listening", label: "Аудирование" },
              ].map((skill) => {
                const pct = skillMap[skill.key] ?? 0
                return (
                  <div key={skill.key} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
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
                {Array.from({ length: firstDow }).map((_, i) => {
                  const prevDay = new Date(year, month, 0).getDate() - firstDow + i + 1
                  return <div key={`p-${i}`} className="calendar-day other-month">{prevDay}</div>
                })}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = day === now.getDate()
                  const hasLesson = lessonDays.has(day)
                  const cls = [
                    "calendar-day",
                    isToday ? "today" : "",
                    hasLesson ? "has-event" : "",
                  ].filter(Boolean).join(" ")
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
            <p style={{ textAlign: "center", color: "#64748B", padding: "32px 0" }}>
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
                    ? "status-success"
                    : hw.status === "overdue"
                      ? "status-danger"
                      : "status-pending"
                  const statusLabel = {
                    pending: "Ожидает",
                    in_progress: "В работе",
                    submitted: "Сдано",
                    reviewed: "Проверено",
                    overdue: "Просрочено",
                  }[hw.status] ?? hw.status

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
