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
    { href: "/dashboard", label: "Главная", icon: Home },
    { href: "/dashboard/schedule", label: "Расписание", icon: Calendar },
    { href: "/dashboard/materials", label: "Материалы", icon: FileText },
    { href: "/dashboard/ai-summary", label: "AI Саммари", icon: Brain },
    { href: "/dashboard/achievements", label: "Достижения", icon: Trophy },
  ],
  teacher: [
    { href: "/teacher", label: "Главная", icon: Home },
    { href: "/teacher/students", label: "Ученики", icon: Users },
    { href: "/teacher/schedule", label: "Расписание", icon: Calendar },
    { href: "/teacher/materials", label: "Материалы", icon: FileText },
    { href: "/teacher/settings", label: "Настройки", icon: Settings },
  ],
  admin: [
    { href: "/dashboard", label: "Обзор", icon: BarChart3 },
    { href: "/dashboard/users", label: "Пользователи", icon: Users },
    { href: "/dashboard/teachers", label: "Преподаватели", icon: BookOpen },
    { href: "/dashboard/payments", label: "Платежи", icon: CreditCard },
    { href: "/dashboard/content", label: "Контент", icon: FileText },
    { href: "/dashboard/settings", label: "Настройки", icon: Settings },
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
        "flex h-full flex-col border-r bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center">
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: "#722F37" }}
            >
              RAW English
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className={cn(collapsed && "mx-auto")}
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
            const isHome = item.href === "/dashboard" || item.href === "/teacher"
            const isActive =
              pathname === item.href ||
              (!isHome && pathname.startsWith(item.href))
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#722F37]/10 text-[#722F37]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon
                    className={cn("size-5 shrink-0", isActive && "text-[#722F37]")}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Separator />

      {/* Footer */}
      <div className="p-2">
        {!collapsed && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RAW English
          </p>
        )}
      </div>
    </aside>
  )
}
