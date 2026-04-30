"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Calendar,
  FileText,
  Brain,
  Trophy,
  Users,
  Settings,
  BarChart3,
  CreditCard,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type Role = "student" | "teacher" | "admin"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navigationByRole: Record<Role, NavItem[]> = {
  student: [
    { href: "/student", label: "Главная", icon: Home },
    { href: "/student/schedule", label: "Расписание", icon: Calendar },
    { href: "/student/materials", label: "Материалы", icon: FileText },
    { href: "/student/summaries", label: "AI Саммари", icon: Brain },
    { href: "/student/achievements", label: "Достижения", icon: Trophy },
  ],
  teacher: [
    { href: "/teacher", label: "Главная", icon: Home },
    { href: "/teacher/students", label: "Ученики", icon: Users },
    { href: "/teacher/schedule", label: "Расписание", icon: Calendar },
    { href: "/teacher/materials", label: "Материалы", icon: FileText },
    { href: "/teacher/settings", label: "Настройки", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Обзор", icon: BarChart3 },
    { href: "/admin/users", label: "Пользователи", icon: Users },
    { href: "/admin/teachers", label: "Преподаватели", icon: BookOpen },
    { href: "/admin/payments", label: "Платежи", icon: CreditCard },
  ],
}

interface SidebarProps {
  role: Role
  collapsed: boolean
  onToggleCollapse: () => void
}

export function DashboardSidebar({
  role,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const navItems = navigationByRole[role] ?? navigationByRole.student

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#1E1E1E] text-white transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-raw-full.svg" alt="RAW English" className="h-7 brightness-0 invert" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className={cn("text-white/70 hover:text-white hover:bg-white/10", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Навигация панели управления">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isHome =
              item.href === "/student" ||
              item.href === "/teacher" ||
              item.href === "/admin"
            const isActive =
              pathname === item.href ||
              (!isHome && pathname.startsWith(item.href))
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#DFED8C] text-[#1E1E1E]"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn("size-5 shrink-0", isActive && "text-[#1E1E1E]")}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2">
        {!collapsed && (
          <p className="px-3 py-2 text-xs text-white/40">
            &copy; {new Date().getFullYear()} RAW English by V. Kratkovskaya
          </p>
        )}
      </div>
    </aside>
  )
}
