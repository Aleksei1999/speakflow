"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { RawLogo } from "@/components/ui/raw-logo"
import { Toaster } from "@/components/ui/sonner"

const SHELL_CSS = `
:root,[data-theme="light"]{
  --red:#E63946;--lime:#D8F26A;--lime-dark:#5A7A00;
  --bg:#F5F5F3;--surface:#fff;--surface-2:#FAFAF7;
  --border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A;
  --accent-dark:#0A0A0A;--shadow:rgba(10,10,10,.04);
}
[data-theme="dark"]{
  --red:#E63946;--lime:#D8F26A;--lime-dark:#D8F26A;
  --bg:#0F0F0E;--surface:#1A1A18;--surface-2:#222220;
  --border:#2A2A28;--muted:#8A8A86;--text:#F5F5F3;
  --accent-dark:#1A1A18;--shadow:rgba(0,0,0,.3);
}
.dash{display:grid;grid-template-columns:260px 1fr;min-height:100vh;font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;transition:background .2s ease,color .2s ease}
.dash *{box-sizing:border-box;margin:0;padding:0}
.dash a{color:inherit;text-decoration:none}
.dash button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* ===== SIDEBAR ===== */
.dash .sidebar{background:var(--surface);border-right:1px solid var(--border);padding:20px 16px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.dash .sidebar-logo{padding:6px 10px;margin-bottom:20px;display:flex;align-items:center;text-decoration:none}
[data-theme="dark"] .dash .sidebar-logo img{filter:brightness(0) invert(1)}

.dash .profile-card{background:var(--surface-2);border-radius:18px;padding:20px 14px;text-align:center;margin-bottom:18px;transition:background .2s ease}
.dash .profile-photo{width:64px;height:64px;border-radius:50%;background:var(--red);border:3px solid var(--lime);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff;object-fit:cover}
.dash .profile-photo-img{width:64px;height:64px;border-radius:50%;border:3px solid var(--lime);margin:0 auto 10px;display:block;object-fit:cover}
/* Hybrid avatar: initials underneath, <img> on top. If <img> fails to load,
   onError hides it and the initials fallback shows through. */
.dash .profile-photo-wrap{position:relative;width:64px;height:64px;margin:0 auto 10px}
.dash .profile-photo-wrap .profile-photo,
.dash .profile-photo-wrap .profile-photo-img{position:absolute;inset:0;margin:0}
.dash .profile-name{font-weight:800;font-size:16px;letter-spacing:-.3px}
.dash .profile-role{font-size:12px;color:var(--muted);margin-top:3px}
.dash .profile-level{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700;background:rgba(230,57,70,.08);color:var(--red)}
.dash .profile-xp{margin-top:10px}
.dash .profile-xp-row{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:3px}
.dash .profile-xp-bar{height:4px;background:var(--border);border-radius:100px;overflow:hidden}
.dash .profile-xp-fill{height:100%;border-radius:100px;background:linear-gradient(90deg,var(--red),var(--lime))}
.dash .profile-streak{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;padding:6px;background:var(--lime);border-radius:10px;font-size:11px;font-weight:700;color:#0A0A0A}
.dash .profile-rating{display:inline-flex;align-items:center;gap:4px;background:var(--lime);color:#0A0A0A;padding:4px 12px;border-radius:100px;font-size:11px;font-weight:700;margin-top:10px}

.dash .nav{list-style:none;display:flex;flex-direction:column;gap:2px;margin-bottom:16px}
.dash .nav a{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;color:var(--muted);font-size:14px;font-weight:500;transition:background .15s ease,color .15s ease;position:relative}
.dash .nav a:hover{background:var(--bg);color:var(--text)}
.dash .nav a.active{background:var(--accent-dark);color:#fff;font-weight:700}
[data-theme="dark"] .dash .nav a.active{background:var(--red)}
.dash .nav .icon{width:18px;height:18px;flex-shrink:0;display:flex;align-items:center}
.dash .nav .icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dash .nav-badge{margin-left:auto;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700;background:var(--red);color:#fff}
.dash .nav a.active .nav-badge{background:#fff;color:var(--accent-dark)}
.dash .nav-section{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 14px 6px}

.dash .sidebar-footer{margin-top:auto;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px}
.dash .sidebar-footer .dot{width:6px;height:6px;background:#22c55e;border-radius:50%}

/* ===== MAIN ===== */
.dash .main-content{padding:24px 28px;min-width:0;overflow-y:auto}

/* Shared element styles reused by pages */
.dash .btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:100px;font-size:12px;font-weight:600;transition:all .15s;cursor:pointer;border:none}
.dash .btn:active{transform:scale(.97)}
.dash .btn-sm{padding:5px 12px;font-size:11px}
.dash .btn-outline{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.dash .btn-outline:hover{border-color:var(--text)}
.dash .btn-red{background:var(--accent-dark);color:#fff}
.dash .btn-red:hover{background:var(--red)}
.dash .btn-lime{background:var(--lime);color:#0A0A0A}

.dash .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.dash .card-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.dash .card-head h3{font-size:16px;font-weight:800;letter-spacing:-.3px}
.dash .card-body{padding:8px 20px 16px}

/* shadcn overrides still used on other pages */
.dash [data-slot="card"]{background:var(--surface);border-radius:16px;padding:24px;border:1px solid var(--border)}
.dash [data-slot="card-header"]{padding:0;margin-bottom:16px;border:none}
.dash [data-slot="card-title"]{font-size:16px;font-weight:800}
.dash [data-slot="card-content"]{padding:0}
.dash [data-slot="badge"]{border-radius:10px;font-weight:600}
.dash [data-slot="button"]{border-radius:12px;font-weight:600}
.dash [data-slot="tabs-list"]{border-radius:14px;background:var(--surface-2);padding:4px;border:1px solid var(--border)}
.dash [data-slot="tabs-trigger"]{border-radius:10px;font-weight:600}
.dash [data-slot="tabs-trigger"][data-state="active"]{background:var(--accent-dark);color:#fff}
.dash [data-slot="avatar-fallback"]{background:var(--lime);color:#0A0A0A;font-weight:700}

@media(max-width:900px){
  .dash{grid-template-columns:1fr}
  .dash .sidebar{display:none}
  .dash .main-content{padding:16px}
}
`

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  leaderboard: '<svg viewBox="0 0 24 24"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10l-1 9H8z"/><path d="M7 8H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3"/><path d="M17 8h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.46.4.97.41 1.51"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  homework: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
  payment: '<svg viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  groups: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 11 20 13 18 11"/></svg>',
  referrals: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>',
  support: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 6-6"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
}

type NavItem = { href: string; label: string; icon: string; badge?: string | number }

const studentNav: NavItem[] = [
  { href: "/student", label: "Dashboard", icon: icons.dashboard },
  { href: "/student/schedule", label: "Расписание", icon: icons.calendar },
  { href: "/student/homework", label: "Домашка", icon: icons.edit },
  { href: "/student/clubs", label: "Speaking Clubs", icon: icons.mic },
  { href: "/student/teachers", label: "Преподаватели", icon: icons.users },
  { href: "/student/achievements", label: "Ачивки", icon: icons.trophy },
  { href: "/student/materials", label: "Материалы", icon: icons.book },
  { href: "/student/leaderboard", label: "Лидерборд", icon: icons.leaderboard },
  { href: "/student/referrals", label: "Рефералы", icon: icons.referrals },
  { href: "/student/support", label: "Поддержка", icon: icons.support },
]
const studentBottom: NavItem[] = [
  { href: "/student/profile", label: "Профиль", icon: icons.profile },
  { href: "/student/settings", label: "Настройки", icon: icons.settings },
]

const teacherNav: NavItem[] = [
  { href: "/teacher", label: "Dashboard", icon: icons.dashboard },
  { href: "/teacher/schedule", label: "Расписание", icon: icons.calendar },
  { href: "/teacher/students", label: "Мои ученики", icon: icons.users },
  { href: "/teacher/groups", label: "Группы", icon: icons.groups },
  { href: "/teacher/clubs", label: "Speaking Clubs", icon: icons.mic },
  { href: "/teacher/homework", label: "Домашние задания", icon: icons.edit },
  { href: "/teacher/materials", label: "Материалы", icon: icons.book },
  { href: "/teacher/payouts", label: "Выплаты", icon: icons.payment },
  { href: "/teacher/support", label: "Поддержка", icon: icons.support },
]
const teacherBottom: NavItem[] = [
  { href: "/teacher/profile", label: "Профиль", icon: icons.profile },
  { href: "/teacher/settings", label: "Настройки", icon: icons.settings },
]

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: icons.dashboard },
  { href: "/admin/students", label: "Ученики", icon: icons.users },
  { href: "/admin/teachers", label: "Преподаватели", icon: icons.profile },
  { href: "/admin/trial-requests", label: "Заявки", icon: icons.clipboard },
  { href: "/admin/schedule", label: "Расписание", icon: icons.calendar },
  { href: "/admin/clubs", label: "Speaking Clubs", icon: icons.mic },
  { href: "/admin/support", label: "Поддержка", icon: icons.support },
]
const adminBottom: NavItem[] = [
  { href: "/admin/reports", label: "Отчёты", icon: icons.reports },
  { href: "/admin/settings", label: "Настройки", icon: icons.settings },
]

function Icon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />
}

type Gamification = {
  xp: number
  level: string
  nextLevel: string | null
  nextLevelXp: number
  currentStreak: number
}

type TeacherStats = {
  rating: number
  totalReviews: number
  yearsExperience: number | null
}

type Props = {
  fullName: string
  avatarUrl: string | null
  role: "student" | "teacher" | "admin" | null
  gamification?: Gamification | null
  teacherStats?: TeacherStats | null
  children: React.ReactNode
}

export function DashboardShell({ fullName, avatarUrl, role, gamification, teacherStats, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // Track <img> load failures so we can fall back to initials. Reset whenever
  // the URL changes (e.g. user re-uploads avatar in /settings).
  const [avatarBroken, setAvatarBroken] = useState(false)
  useEffect(() => { setAvatarBroken(false) }, [avatarUrl])

  // Smooth scroll-to-top whenever route changes between dashboard sections so
  // the user lands at the top of the new page instead of mid-scroll.
  useEffect(() => {
    if (typeof window === "undefined") return
    const main = document.querySelector(".dash .main-content") as HTMLElement | null
    const opts: ScrollToOptions = { top: 0, left: 0, behavior: "smooth" }
    try {
      main?.scrollTo(opts)
      window.scrollTo(opts)
    } catch {
      // Older browsers without smooth-scroll support
      if (main) main.scrollTop = 0
      window.scrollTo(0, 0)
    }
  }, [pathname])

  useEffect(() => {
    if (role) {
      if (
        (pathname.startsWith("/student") && role !== "student") ||
        (pathname.startsWith("/teacher") && role !== "teacher") ||
        (pathname.startsWith("/admin") && role !== "admin")
      ) {
        const roleHome = role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student"
        router.replace(roleHome)
      }
    }
  }, [role, pathname, router])

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? localStorage.getItem("theme") : null) as
      | "light"
      | "dark"
      | "auto"
      | null
    const theme = stored ?? "light"
    const apply = () => {
      const resolved =
        theme === "auto"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme
      document.documentElement.setAttribute("data-theme", resolved)
    }
    apply()
    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      mq.addEventListener("change", apply)
      return () => mq.removeEventListener("change", apply)
    }
  }, [pathname])

  const currentRole = role ?? "student"
  const [supportUnread, setSupportUnread] = useState(0)
  const [teacherClubsUnread, setTeacherClubsUnread] = useState(0)

  useEffect(() => {
    if (currentRole !== "admin") return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/admin/support/unread-count", {
          cache: "no-store",
        })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && typeof json?.count === "number") {
          setSupportUnread(json.count)
        }
      } catch {}
    }

    fetchCount()
    timer = setInterval(fetchCount, 60_000)

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount()
    }
    document.addEventListener("visibilitychange", onVisible)
    const onChanged = () => fetchCount()
    window.addEventListener("support-unread-changed", onChanged as EventListener)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(
        "support-unread-changed",
        onChanged as EventListener
      )
    }
  }, [currentRole])

  useEffect(() => {
    if (currentRole !== "teacher") return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const fetchCount = async () => {
      try {
        const res = await fetch("/api/teacher/clubs/unread-count", {
          cache: "no-store",
        })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && typeof json?.count === "number") {
          setTeacherClubsUnread(json.count)
        }
      } catch {}
    }

    fetchCount()
    timer = setInterval(fetchCount, 60_000)

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount()
    }
    document.addEventListener("visibilitychange", onVisible)
    const onChanged = () => fetchCount()
    window.addEventListener(
      "teacher-clubs-seen-changed",
      onChanged as EventListener
    )

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(
        "teacher-clubs-seen-changed",
        onChanged as EventListener
      )
    }
  }, [currentRole])

  const baseNav =
    currentRole === "admin" ? adminNav : currentRole === "teacher" ? teacherNav : studentNav
  const navItems = useMemo(() => {
    if (currentRole === "admin") {
      return baseNav.map((item) =>
        item.href === "/admin/support" && supportUnread > 0
          ? { ...item, badge: supportUnread }
          : item
      )
    }
    if (currentRole === "teacher") {
      return baseNav.map((item) =>
        item.href === "/teacher/clubs" && teacherClubsUnread > 0
          ? { ...item, badge: teacherClubsUnread }
          : item
      )
    }
    return baseNav
  }, [baseNav, currentRole, supportUnread, teacherClubsUnread])
  const bottomItems =
    currentRole === "admin" ? adminBottom : currentRole === "teacher" ? teacherBottom : studentBottom
  const initials = fullName.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  const roleLabel =
    currentRole === "admin" ? "Админ" : currentRole === "teacher" ? "Преподаватель" : "Ученик"

  const xpProgressPct = gamification
    ? Math.min(100, Math.round((gamification.xp / Math.max(gamification.nextLevelXp, 1)) * 100))
    : 0

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      <div className="dash">
        <aside className="sidebar">
          <div className="sidebar-logo" aria-label="Raw English">
            <RawLogo size={34} />
          </div>

          <div className="profile-card">
            {avatarUrl && !avatarBroken ? (
              <div className="profile-photo-wrap">
                {/* Initials sit underneath; <img> covers them when it loads.
                    If the <img> errors out (CORS, 404, blocked) onError hides
                    it via state and the initials show through. */}
                <div className="profile-photo">{initials || "?"}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="profile-photo-img"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarBroken(true)}
                />
              </div>
            ) : (
              <div className="profile-photo">{initials || "?"}</div>
            )}
            <div className="profile-name">{fullName || "Пользователь"}</div>
            {gamification ? (
              <>
                <div className="profile-level">🔥 {gamification.level} · {gamification.xp} XP</div>
                {gamification.nextLevel ? (
                  <div className="profile-xp">
                    <div className="profile-xp-row">
                      <span>До {gamification.nextLevel}</span>
                      <span>{xpProgressPct}%</span>
                    </div>
                    <div className="profile-xp-bar">
                      <div className="profile-xp-fill" style={{ width: `${xpProgressPct}%` }} />
                    </div>
                  </div>
                ) : null}
                {gamification.currentStreak > 0 ? (
                  <div className="profile-streak">⚡ {gamification.currentStreak}-дневный стрик</div>
                ) : null}
              </>
            ) : teacherStats ? (
              <>
                <div className="profile-role">
                  teacher{teacherStats.yearsExperience ? ` · ${teacherStats.yearsExperience} ${teacherStats.yearsExperience === 1 ? "год" : teacherStats.yearsExperience < 5 ? "года" : "лет"}` : ""}
                </div>
                <div className="profile-rating">
                  ★ {teacherStats.rating.toFixed(1)} · {teacherStats.totalReviews} {teacherStats.totalReviews === 1 ? "отзыв" : teacherStats.totalReviews < 5 ? "отзыва" : "отзывов"}
                </div>
              </>
            ) : (
              <div className="profile-role">{roleLabel}</div>
            )}
          </div>

          <ul className="nav">
            {navItems.map((item) => {
              const isHome = item.href === `/${currentRole}`
              const isActive = pathname === item.href || (!isHome && pathname.startsWith(item.href))
              // Слаг для data-onboarding (для якорей онбординг-тура) — на самой ссылке,
              // а не на <li>, чтобы getBoundingClientRect возвращал реальный visual rect.
              const navSlug = item.href.split("/").filter(Boolean).pop() || "home"
              return (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={isActive ? "active" : ""}
                    data-onboarding={`nav-${navSlug}`}
                  >
                    <Icon svg={item.icon} />
                    {item.label}
                    {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="nav-section">Аккаунт</div>
          <ul className="nav">
            {bottomItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} prefetch={false}>
                  <Icon svg={item.icon} />
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); handleLogout() }}>
                <Icon svg={icons.logout} />
                Выйти
              </a>
            </li>
          </ul>

          <div className="sidebar-footer">
            <span className="dot"></span>
            Онлайн{gamification ? ` · ${gamification.level}` : teacherStats ? " · Status: active" : ` · ${roleLabel}`}
          </div>
        </aside>

        <main className="main-content">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </>
  )
}
