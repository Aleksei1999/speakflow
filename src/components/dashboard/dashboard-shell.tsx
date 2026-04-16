"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const SIDEBAR_CSS = `
:root,[data-theme="light"]{--red:#E63946;--lime:#D8F26A;--bg:#F5F5F3;--surface:#FFFFFF;--surface-2:#FAFAF7;--border:#EEEEEA;--muted:#8A8A86;--text:#0A0A0A;--logo-text:#1E1E1E;--accent-dark:#0A0A0A}
[data-theme="dark"]{--bg:#0F0F0E;--surface:#1A1A18;--surface-2:#222220;--border:#2A2A28;--muted:#8A8A86;--text:#F5F5F3;--logo-text:#F5F5F3;--accent-dark:#1A1A18}
.dash{display:grid;grid-template-columns:260px 1fr;min-height:100vh;font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);transition:background .2s ease,color .2s ease}
.dash *{box-sizing:border-box}
.dash a{color:inherit;text-decoration:none}
.dash button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

.dash .sidebar{width:260px;background:var(--surface);border-right:1px solid var(--border);padding:20px 16px;display:flex;flex-direction:column;height:100vh;overflow-y:auto;position:sticky;top:0;transition:background .2s ease,border-color .2s ease}
.dash .sidebar-logo{display:block;padding:6px 10px;margin-bottom:22px}
.dash .sidebar-logo img{width:100%;max-width:140px;height:auto;display:block}

.dash .profile-card{background:var(--surface-2);border-radius:18px;padding:20px 14px;text-align:center;margin-bottom:22px;transition:background .2s ease}
.dash .profile-card .photo{width:72px;height:72px;border-radius:50%;background:var(--bg);border:3px solid var(--lime);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;color:var(--text)}
.dash .profile-card .pname{font-weight:800;font-size:18px;letter-spacing:-0.3px}
.dash .profile-card .prole{font-size:12px;color:var(--muted);margin-top:3px}
.dash .profile-card .meta{display:inline-flex;align-items:center;gap:4px;background:var(--lime);color:#0A0A0A;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;margin-top:10px}

.dash .nav{list-style:none;display:flex;flex-direction:column;gap:2px;margin-bottom:20px;padding:0}
.dash .nav a{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;color:var(--muted);font-size:14px;font-weight:500;transition:background .15s ease,color .15s ease;position:relative}
.dash .nav a:hover{background:var(--bg);color:var(--text)}
.dash .nav a.active{background:var(--accent-dark);color:#fff;font-weight:700}
[data-theme="dark"] .dash .nav a.active{background:var(--red)}
.dash .nav a .icon{width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.dash .nav a .icon svg{width:18px;height:18px}
.dash .nav a .badge{margin-left:auto;background:var(--red);color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:2px 7px;min-width:18px;text-align:center}
.dash .nav a.active .badge{background:#fff;color:var(--accent-dark)}

.dash .nav-section-title{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:8px 14px 6px}


.dash .main-content{padding:60px;background:var(--bg);min-height:100vh;overflow-y:auto}

/* Override shadcn */
.dash [data-slot="card"]{background:var(--surface);border-radius:35px;padding:40px;box-shadow:0 10px 30px rgba(0,0,0,0.02);border:1px solid var(--border)}
.dash [data-slot="card-header"]{padding:0;margin-bottom:25px;border:none}
.dash [data-slot="card-title"]{font-size:22px;font-weight:700}
.dash [data-slot="card-content"]{padding:0}
.dash [data-slot="badge"]{border-radius:10px;font-weight:600}
.dash [data-slot="button"]{border-radius:15px;font-weight:600}
.dash [data-slot="tabs-list"]{border-radius:20px;background:var(--surface-2);padding:4px;border:1px solid var(--border)}
.dash [data-slot="tabs-trigger"]{border-radius:16px;font-weight:600}
.dash [data-slot="tabs-trigger"][data-state="active"]{background:var(--accent-dark);color:#fff}
.dash [data-slot="avatar-fallback"]{background:var(--lime);color:#0A0A0A;font-weight:700}
.dash table{width:100%;border-collapse:collapse}
.dash table th{text-align:left;font-size:12px;text-transform:uppercase;color:var(--muted);font-weight:600;padding:12px 16px;border-bottom:1px solid var(--border)}
.dash table td{padding:16px;border-bottom:1px solid var(--border)}
.dash table tbody tr:hover{background:var(--surface-2)}
.dash h1{font-size:32px;font-weight:800}.dash h2{font-size:24px;font-weight:700}

/* Dashboard page specific */
.dash .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:25px;margin-bottom:50px}
.dash .stat-card{background:var(--surface);padding:35px 25px;border-radius:35px;box-shadow:0 10px 30px rgba(0,0,0,0.02);text-align:center;border:1px solid var(--border)}
.dash .stat-card.dark{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
.dash .stat-card.accent{background:var(--lime);border-color:var(--lime)}
.dash .stat-num{font-size:36px;font-weight:800;display:block}
.dash .stat-desc{font-size:14px;opacity:.7;margin-top:10px;display:block}
.dash .dashboard-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:30px}
.dash .card{background:var(--surface);border-radius:35px;padding:40px;box-shadow:0 10px 30px rgba(0,0,0,0.02);border:1px solid var(--border)}
.dash .card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;border:none;padding:0}
.dash .card-title{font-size:22px;font-weight:700;margin:0}
.dash .lesson-row{display:flex;align-items:center;padding:25px 0;border-top:1px solid var(--border)}
.dash .time-badge{width:60px;height:60px;background:var(--accent-dark);color:#fff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:14px;margin-right:25px;flex-shrink:0}
.dash .lesson-info h4{margin:0;font-size:18px}.dash .lesson-info p{margin:5px 0 0;color:var(--muted);font-size:14px}
.dash .progress-item{margin-bottom:25px}.dash .progress-labels{display:flex;justify-content:space-between;margin-bottom:10px;font-weight:600}
.dash .progress-track{height:12px;background:var(--surface-2);border-radius:10px;overflow:hidden;border:1px solid var(--border)}.dash .progress-bar{height:100%;background:var(--accent-dark);border-radius:10px}
.dash .btn{padding:12px 25px;border-radius:15px;border:none;font-weight:600;cursor:pointer;font-size:14px;transition:.2s;display:inline-flex;align-items:center;justify-content:center}
.dash .btn-black{background:var(--accent-dark);color:#fff}.dash .btn-outline{background:transparent;border:2px solid var(--accent-dark);color:var(--text)}
.dash .btn:hover{transform:translateY(-2px);opacity:.9}

@media(max-width:1024px){.dash .stats-grid{grid-template-columns:repeat(2,1fr)}.dash .dashboard-grid{grid-template-columns:1fr}.dash .main-content{padding:30px}}
@media(max-width:900px){.dash{grid-template-columns:1fr}.dash .sidebar{width:100%;height:auto;border-right:none;border-bottom:1px solid var(--border);position:static}}
`

const icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  homework: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09c-.658.003-1.25.396-1.51 1z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
}

const studentNav = [
  { href: "/student", label: "Главная", icon: icons.dashboard },
  { href: "/student/schedule", label: "Мои уроки", icon: icons.calendar, badge: true },
  { href: "/teachers", label: "Преподаватели", icon: icons.users },
  { href: "/student/materials", label: "Домашние задания", icon: icons.homework, badge: true },
  { href: "/student/achievements", label: "Мой прогресс", icon: icons.progress },
  { href: "/student/summaries", label: "AI Саммари", icon: icons.payment },
]
const studentBottom = [
  { href: "#", label: "Помощь", icon: icons.help },
  { href: "#", label: "Чат поддержки", icon: icons.chat },
]

const teacherNav = [
  { href: "/teacher", label: "Dashboard", icon: icons.dashboard },
  { href: "/teacher/schedule", label: "Расписание", icon: icons.calendar, badge: true },
  { href: "/teacher/students", label: "Мои ученики", icon: icons.users, badge: true },
  { href: "/teacher/materials", label: "Домашние задания", icon: icons.edit, badge: true },
  { href: "/teacher/materials", label: "Материалы", icon: icons.book },
  { href: "#", label: "Выплаты", icon: icons.payment },
]
const teacherBottom = [
  { href: "#", label: "Профиль", icon: icons.profile },
  { href: "/teacher/settings", label: "Настройки", icon: icons.settings },
]

function Icon({ svg }: { svg: string }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />
}

type Props = {
  fullName: string
  avatarUrl: string | null
  role: "student" | "teacher" | "admin" | null
  children: React.ReactNode
}

export function DashboardShell({ fullName, avatarUrl, role, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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

  const currentRole = role ?? "student"
  const navItems = currentRole === "teacher" ? teacherNav : studentNav
  const bottomItems = currentRole === "teacher" ? teacherBottom : studentBottom
  const initials = fullName.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const roleLabel = currentRole === "teacher" ? "Преподаватель" : "Ученик"

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SIDEBAR_CSS }} />
      <div className="dash">
        <aside className="sidebar">
          <Link href="/" className="sidebar-logo">
            <img src="/logo-raw-full.svg" alt="Raw English" />
          </Link>

          <div className="profile-card">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} style={{width:72,height:72,borderRadius:"50%",border:"3px solid var(--lime)",objectFit:"cover",margin:"0 auto 10px",display:"block"}} />
            ) : (
              <div className="photo">{initials || "?"}</div>
            )}
            <div className="pname">{fullName || "Пользователь"}</div>
            <div className="prole">{roleLabel}</div>
            <div className="meta">● Online</div>
          </div>

          <ul className="nav">
            {navItems.map((item) => {
              const isHome = item.href === `/${currentRole}`
              const isActive = pathname === item.href || (!isHome && item.href !== "/teachers" && pathname.startsWith(item.href))
              return (
                <li key={item.href + item.label}>
                  <Link href={item.href} className={isActive ? "active" : ""}>
                    <Icon svg={item.icon} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="nav-section-title">{currentRole === "teacher" ? "Настройки" : "Поддержка"}</div>
          <ul className="nav">
            {bottomItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href}>
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
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </>
  )
}
