"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import "./student/dashboard.css"

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, role } = useUser()
  const pathname = usePathname()
  const router = useRouter()

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
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="logo">
          <img src="/logo-raw-full.svg" alt="RAW English" style={{ height: 28, filter: "brightness(0) invert(1)" }} />
        </Link>

        <ul className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/${currentRole}` && pathname.startsWith(item.href))
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
                  <Link href={item.href}>
                    <span className="icon">{item.icon}</span> {item.label}
                  </Link>
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

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
