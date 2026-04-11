"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"

const studentNav = [
  { href: "/student", label: "Главная", icon: "📊" },
  { href: "/student/schedule", label: "Мои уроки", icon: "📅" },
  { href: "/teachers", label: "Преподаватели", icon: "👨‍🏫" },
  { href: "/student/materials", label: "Домашние задания", icon: "📝" },
  { href: "/student/achievements", label: "Мой прогресс", icon: "📈" },
  { href: "/student/summaries", label: "AI Саммари", icon: "🤖" },
]

const studentSupport = [
  { href: "#", label: "Помощь", icon: "❓" },
  { href: "#", label: "Чат поддержки", icon: "💬" },
]

const teacherNav = [
  { href: "/teacher", label: "Главная", icon: "📊" },
  { href: "/teacher/students", label: "Мои ученики", icon: "👥" },
  { href: "/teacher/schedule", label: "Расписание", icon: "📅" },
  { href: "/teacher/materials", label: "Материалы", icon: "📝" },
  { href: "/teacher/settings", label: "Настройки", icon: "⚙️" },
]

const adminNav = [
  { href: "/admin", label: "Обзор", icon: "📊" },
  { href: "/admin/users", label: "Пользователи", icon: "👥" },
  { href: "/admin/teachers", label: "Преподаватели", icon: "👨‍🏫" },
  { href: "/admin/payments", label: "Платежи", icon: "💳" },
  { href: "/admin/content", label: "Контент", icon: "📝" },
]

const DASH_CSS = `
  .dash { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; }
  .dash * { box-sizing: border-box; }
  .dash a { text-decoration: none; color: inherit; }

  .dash .sidebar { width: 260px; background: #1E293B; color: white; padding: 24px 0; position: fixed; height: 100vh; overflow-y: auto; flex-shrink: 0; }
  .dash .sidebar .logo { font-size: 24px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px; padding: 0 24px; margin-bottom: 32px; }
  .dash .sidebar-nav { list-style: none; padding: 0; margin: 0; }
  .dash .sidebar-nav li a { display: flex; align-items: center; gap: 12px; padding: 12px 24px; color: #94A3B8; font-size: 14px; transition: all 0.2s; }
  .dash .sidebar-nav li a:hover, .dash .sidebar-nav li a.active { background: rgba(255,255,255,0.1); color: white; }
  .dash .sidebar-nav li a.active { border-left: 3px solid #CC3A3A; }
  .dash .sidebar-nav .icon { font-size: 18px; width: 24px; text-align: center; }
  .dash .sidebar-section { margin-top: 32px; padding: 0 24px; }
  .dash .sidebar-section h4 { font-size: 12px; text-transform: uppercase; color: #94A3B8; margin-bottom: 16px; letter-spacing: 0.5px; }

  .dash .main-content { flex: 1; margin-left: 260px; padding: 32px; background: #F8FAFC; min-height: 100vh; }
  .dash .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .dash .dashboard-header h1 { font-size: 28px; font-weight: 700; color: #1E293B; }

  .dash .user-menu { display: flex; align-items: center; gap: 16px; }
  .dash .user-avatar { width: 40px; height: 40px; background: #CC3A3A; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px; }
  .dash .notifications { width: 40px; height: 40px; background: #F1F5F9; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; font-size: 18px; }
  .dash .notifications .badge { position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; background: #EF4444; border-radius: 50%; font-size: 11px; display: flex; align-items: center; justify-content: center; color: white; }

  .dash .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 32px; }
  .dash .stat-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .dash .stat-card .label { font-size: 14px; color: #64748B; margin-bottom: 8px; }
  .dash .stat-card .value { font-size: 32px; font-weight: 700; color: #1E293B; }
  .dash .stat-card .change { font-size: 13px; margin-top: 8px; color: #64748B; }
  .dash .stat-card .change.positive { color: #10B981; }

  .dash .dashboard-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
  .dash .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .dash .card-header { padding: 20px 24px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; }
  .dash .card-header h3 { font-size: 18px; font-weight: 700; color: #1E293B; margin: 0; }
  .dash .card-body { padding: 24px; }

  .dash .schedule-item { display: flex; align-items: center; gap: 16px; padding: 16px; background: #F8FAFC; border-radius: 8px; margin-bottom: 12px; }
  .dash .schedule-item:last-child { margin-bottom: 0; }
  .dash .schedule-time { text-align: center; min-width: 60px; }
  .dash .schedule-time .time { font-size: 18px; font-weight: 700; color: #CC3A3A; }
  .dash .schedule-time .date { font-size: 12px; color: #64748B; }
  .dash .schedule-info { flex: 1; }
  .dash .schedule-info h4 { font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: #1E293B; }
  .dash .schedule-info p { font-size: 13px; color: #64748B; margin: 0; }

  .dash .progress-bar { height: 8px; background: #E2E8F0; border-radius: 4px; overflow: hidden; }
  .dash .progress-fill { height: 100%; background: linear-gradient(90deg, #CC3A3A 0%, #10B981 100%); border-radius: 4px; }

  .dash .calendar-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; }
  .dash .calendar-header span { text-align: center; font-size: 12px; font-weight: 600; color: #64748B; padding: 8px 0; }
  .dash .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .dash .calendar-day { display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; padding: 8px 4px; position: relative; color: #1E293B; }
  .dash .calendar-day:hover { background: #F1F5F9; }
  .dash .calendar-day.today { background: #CC3A3A; color: white; font-weight: 700; }
  .dash .calendar-day.has-event::after { content: ''; position: absolute; bottom: 2px; width: 4px; height: 4px; background: #10B981; border-radius: 50%; }
  .dash .calendar-day.other-month { color: #CBD5E1; }

  .dash .table { width: 100%; border-collapse: collapse; }
  .dash .table th { text-align: left; font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: 600; padding: 8px 16px; border-bottom: 2px solid #E2E8F0; }
  .dash .table td { padding: 12px 16px; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #1E293B; }
  .dash .table tbody tr:hover { background: #F8FAFC; }

  .dash .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .dash .status-success { background: #D1FAE5; color: #059669; }
  .dash .status-pending { background: #FEF3C7; color: #D97706; }
  .dash .status-danger { background: #FEE2E2; color: #DC2626; }

  .dash .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; border: none; text-decoration: none; }
  .dash .btn-primary { background: #CC3A3A; color: white; }
  .dash .btn-primary:hover { background: #a32e2e; }
  .dash .btn-secondary { background: white; color: #1E293B; border: 1px solid #E2E8F0; }
  .dash .btn-secondary:hover { background: #F8FAFC; }
  .dash .btn-sm { padding: 6px 12px; font-size: 13px; }

  @media (max-width: 1024px) {
    .dash .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .dash .dashboard-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .dash .sidebar { display: none; }
    .dash .main-content { margin-left: 0; }
    .dash .stats-grid { grid-template-columns: 1fr; }
  }
`

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, role, isLoading } = useUser()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && role) {
      const roleHome = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student'
      if (
        (pathname.startsWith('/student') && role !== 'student') ||
        (pathname.startsWith('/teacher') && role !== 'teacher') ||
        (pathname.startsWith('/admin') && role !== 'admin')
      ) {
        router.replace(roleHome)
      }
    }
  }, [isLoading, role, pathname, router])

  const currentRole = role ?? "student"
  const navItems = currentRole === "admin" ? adminNav : currentRole === "teacher" ? teacherNav : studentNav
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DASH_CSS }} />
      <div className="dash">
        <aside className="sidebar">
          <Link href="/" className="logo">
            <img src="/logo-raw-full.svg" alt="RAW English" style={{ height: 28, filter: "brightness(0) invert(1)" }} />
          </Link>

          <ul className="sidebar-nav">
            {navItems.map((item) => {
              const isHome = item.href === `/${currentRole}`
              const isActive = pathname === item.href || (!isHome && item.href !== "/teachers" && pathname.startsWith(item.href))
              return (
                <li key={item.href}>
                  <Link href={item.href} className={isActive ? "active" : ""}>
                    <span className="icon">{item.icon}</span> {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {currentRole === "student" && (
            <div className="sidebar-section">
              <h4>Поддержка</h4>
              <ul className="sidebar-nav">
                {studentSupport.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}><span className="icon">{item.icon}</span> {item.label}</Link>
                  </li>
                ))}
                <li>
                  <a href="#" onClick={(e) => { e.preventDefault(); handleLogout() }}>
                    <span className="icon">🚪</span> Выйти
                  </a>
                </li>
              </ul>
            </div>
          )}
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </>
  )
}
