// @ts-nocheck
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  const { data: teacherProfile } = await supabase.from("teacher_profiles").select("*").eq("user_id", user.id).single()

  const now = new Date()
  const todayStart = startOfDay(now).toISOString()
  const todayEnd = endOfDay(now).toISOString()
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  // Today's lessons
  const { data: todayLessons } = await supabase
    .from("lessons")
    .select("id, scheduled_at, duration_minutes, status, student_id")
    .eq("teacher_id", teacherProfile?.id ?? "")
    .gte("scheduled_at", todayStart)
    .lte("scheduled_at", todayEnd)
    .order("scheduled_at", { ascending: true })

  // Month lessons count
  const { count: monthLessons } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherProfile?.id ?? "")
    .gte("scheduled_at", monthStart)
    .lte("scheduled_at", monthEnd)

  // Active students
  const { data: activeStudentsData } = await supabase
    .from("lessons")
    .select("student_id")
    .eq("teacher_id", teacherProfile?.id ?? "")
    .in("status", ["booked", "completed", "in_progress"])
  const uniqueStudents = new Set(activeStudentsData?.map((l) => l.student_id) ?? [])

  // Students list for table
  const studentIds = [...uniqueStudents]
  let studentsInfo: any[] = []
  if (studentIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", studentIds)
    studentsInfo = data ?? []
  }

  const firstName = profile.full_name?.split(" ")[0] ?? "Преподаватель"
  const initials = profile.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"

  return (
    <>
      <div className="dashboard-header">
        <h1>Добрый день, {firstName}!</h1>
        <div className="user-menu">
          <div className="notifications">
            🔔
            <span className="badge">5</span>
          </div>
          <div className="user-avatar">{initials}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Уроков в этом месяце</div>
          <div className="value">{monthLessons ?? 0}</div>
          <div className="change positive">+12% к прошлому</div>
        </div>
        <div className="stat-card">
          <div className="label">Активных учеников</div>
          <div className="value">{uniqueStudents.size}</div>
          <div className="change positive">+{Math.min(uniqueStudents.size, 3)} новых</div>
        </div>
        <div className="stat-card">
          <div className="label">Рейтинг</div>
          <div className="value">{teacherProfile?.rating?.toFixed(1) ?? "0.0"} ⭐</div>
          <div className="change">На основе {teacherProfile?.total_reviews ?? 0} отзывов</div>
        </div>
        <div className="stat-card">
          <div className="label">Заработано</div>
          <div className="value">{((teacherProfile?.total_lessons ?? 0) * (teacherProfile?.hourly_rate ?? 0)).toLocaleString("ru-RU")} ₽</div>
          <div className="change positive">К выплате 15 числа</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Today's Schedule */}
        <div className="card">
          <div className="card-header">
            <h3>Сегодня, {format(now, "d MMMM", { locale: ru })}</h3>
            <Link href="/teacher/schedule" className="btn btn-sm btn-secondary">Полное расписание</Link>
          </div>
          <div className="card-body">
            {(todayLessons ?? []).length === 0 ? (
              <p style={{ textAlign: "center", color: "#64748B", padding: "32px 0" }}>
                На сегодня уроков нет
              </p>
            ) : (
              (todayLessons ?? []).map((l) => {
                const date = new Date(l.scheduled_at)
                const isPast = date < now
                const isCurrent = !isPast && date.getTime() - now.getTime() < 30 * 60 * 1000
                const bgStyle = isCurrent ? { background: "#FFF0F0" } : {}

                return (
                  <div key={l.id} className="schedule-item" style={bgStyle}>
                    <div className="schedule-time">
                      <div className="time">{format(date, "HH:mm")}</div>
                      <div className="date">{l.duration_minutes} мин</div>
                    </div>
                    <div className="schedule-info">
                      <h4>Ученик</h4>
                      <p>Урок английского</p>
                    </div>
                    <div className="schedule-actions">
                      {l.status === "completed" ? (
                        <span className="status status-success">Завершён</span>
                      ) : isCurrent ? (
                        <Link href={`/teacher/lesson/${l.id}`} className="btn btn-primary btn-sm">Начать</Link>
                      ) : (
                        <span className="status status-pending">Ожидается</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Quick Actions & Stats */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>Быстрые действия</h3>
            </div>
            <div className="card-body">
              <Link href="/teacher/schedule" className="btn btn-primary" style={{ width: "100%", marginBottom: 12 }}>
                📅 Управление слотами
              </Link>
              <Link href="#" className="btn btn-secondary" style={{ width: "100%", marginBottom: 12 }}>
                📝 Создать задание
              </Link>
              <Link href="/teacher/materials" className="btn btn-secondary" style={{ width: "100%", marginBottom: 12 }}>
                📤 Отправить материалы
              </Link>
              <Link href="#" className="btn btn-secondary" style={{ width: "100%" }}>
                💬 Написать ученику
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Статистика за неделю</h3>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                  <span>Проведено уроков</span>
                  <span><strong>{teacherProfile?.total_lessons ?? 0}</strong></span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "80%" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                  <span>Проверено заданий</span>
                  <span><strong>—</strong></span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "0%" }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                  <span>Отменено учениками</span>
                  <span><strong>0</strong></span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "0%", background: "#EF4444" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Мои ученики</h3>
          <Link href="/teacher/students" className="btn btn-sm btn-secondary">Все ученики</Link>
        </div>
        <div className="card-body">
          {studentsInfo.length === 0 ? (
            <p style={{ textAlign: "center", color: "#64748B", padding: "32px 0" }}>
              Учеников пока нет
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Ученик</th>
                  <th>Уроков проведено</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {studentsInfo.map((s) => {
                  const si = s.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"
                  const colors = ["#CC3A3A", "#10B981", "#F59E0B", "#EC4899", "#6366F1"]
                  const color = colors[s.full_name?.charCodeAt(0) % colors.length] ?? "#CC3A3A"
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div className="user-avatar" style={{ width: 36, height: 36, fontSize: 14, background: color }}>{si}</div>
                          <div>
                            <strong>{s.full_name}</strong>
                            <div style={{ fontSize: 12, color: "#64748B" }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>—</td>
                      <td><Link href="#" className="btn btn-sm btn-secondary">Профиль</Link></td>
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
