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
  { href: "/teacher/schedule", label: "Расписание", icon: "📅" },
  { href: "/teacher/students", label: "Мои ученики", icon: "👥" },
  { href: "/teacher/materials", label: "Материалы", icon: "📚" },
  { href: "/teacher/settings", label: "Настройки", icon: "⚙️" },
]

const teacherSupport = [
  { href: "#", label: "Профиль", icon: "👤" },
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
  :root { --bg: #F8F9FA; --white: #FFFFFF; --black: #000000; --gray-light: #E9ECEF; --gray-text: #6C757D; --accent: #D4FF5C; --radius: 35px; }

  .dash { display: flex; min-height: 100vh; font-family: 'Inter', sans-serif; }
  .dash * { box-sizing: border-box; }
  .dash a { text-decoration: none; color: inherit; }

  .dash .sidebar { width: 280px; background: var(--white); padding: 50px 30px; display: flex; flex-direction: column; border-right: 1px solid var(--gray-light); position: sticky; top: 0; height: 100vh; flex-shrink: 0; }
  .dash .sidebar .logo { width: 160px; margin-bottom: 60px; }
  .dash .sidebar-nav { list-style: none; padding: 0; margin: 0; flex-grow: 1; }
  .dash .sidebar-nav li { margin-bottom: 0; }
  .dash .sidebar-nav li a { display: flex; align-items: center; padding: 16px 20px; color: var(--black); font-weight: 600; border-radius: 20px; margin-bottom: 10px; transition: 0.3s; font-size: 14px; }
  .dash .sidebar-nav li a.active { background: var(--black); color: var(--white); }
  .dash .sidebar-nav li a:hover:not(.active) { background: var(--gray-light); }
  .dash .sidebar-nav .icon { font-size: 18px; width: 24px; text-align: center; margin-right: 12px; }
  .dash .sidebar-section { margin-top: auto; padding-top: 30px; border-top: 1px solid var(--gray-light); }
  .dash .sidebar-section h4 { display: none; }
  .dash .sidebar-section li a { color: var(--gray-text) !important; }
  .dash .sidebar-section li a.active { background: var(--gray-light) !important; color: var(--black) !important; }

  .dash .main-content { flex: 1; padding: 60px; background: var(--bg); min-height: 100vh; max-width: 1300px; }
  .dash .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
  .dash .header h1 { font-size: 32px; font-weight: 800; margin: 0; color: var(--black); }
  .dash .user-profile { display: flex; align-items: center; gap: 15px; background: var(--white); padding: 8px 25px; border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); font-size: 14px; font-weight: 600; }
  .dash .avatar { width: 40px; height: 40px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }

  .dash .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 25px; margin-bottom: 50px; }
  .dash .stat-card { background: var(--white); padding: 35px 25px; border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,0.02); text-align: center; }
  .dash .stat-card.dark { background: var(--black); color: var(--white); }
  .dash .stat-card.accent { background: var(--accent); }
  .dash .stat-num { font-size: 36px; font-weight: 800; display: block; }
  .dash .stat-desc { font-size: 14px; opacity: 0.7; margin-top: 10px; display: block; }

  .dash .dashboard-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 30px; }
  .dash .card { background: var(--white); border-radius: var(--radius); padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
  .dash .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border: none; padding: 0; }
  .dash .card-title { font-size: 22px; font-weight: 700; margin: 0; }

  .dash .lesson-row { display: flex; align-items: center; padding: 25px 0; border-top: 1px solid var(--gray-light); }
  .dash .time-badge { width: 60px; height: 60px; background: var(--black); color: var(--white); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; margin-right: 25px; flex-shrink: 0; }
  .dash .lesson-info h4 { margin: 0; font-size: 18px; }
  .dash .lesson-info p { margin: 5px 0 0; color: var(--gray-text); font-size: 14px; }

  .dash .progress-item { margin-bottom: 25px; }
  .dash .progress-labels { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: 600; }
  .dash .progress-track { height: 12px; background: var(--gray-light); border-radius: 10px; overflow: hidden; }
  .dash .progress-bar { height: 100%; background: var(--black); border-radius: 10px; }

  .dash .btn { padding: 12px 25px; border-radius: 15px; border: none; font-weight: 600; cursor: pointer; text-decoration: none; font-size: 14px; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; }
  .dash .btn-black { background: var(--black); color: var(--white); }
  .dash .btn-outline { background: transparent; border: 2px solid var(--black); color: var(--black); }
  .dash .btn:hover { transform: translateY(-2px); opacity: 0.9; }

  @media (max-width: 1024px) {
    .dash .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .dash .dashboard-grid { grid-template-columns: 1fr; }
    .dash .main-content { padding: 30px; }
  }
  @media (max-width: 768px) {
    .dash .sidebar { display: none; }
    .dash .stats-grid { grid-template-columns: 1fr; }
  }
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

          <div className="sidebar-section">
            <h4>{currentRole === "teacher" ? "Настройки" : "Поддержка"}</h4>
            <ul className="sidebar-nav">
              {(currentRole === "teacher" ? teacherSupport : studentSupport).map((item) => (
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
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </>
  )
}
