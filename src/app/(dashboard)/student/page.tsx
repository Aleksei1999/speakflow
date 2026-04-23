// @ts-nocheck
import { redirect } from "next/navigation"
import { format, startOfDay, endOfDay, subDays } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { BookingLauncher } from "./_components/booking-launcher"
import { QuickActions } from "./_components/quick-actions"
import { LandingXpClaimer } from "./_components/landing-xp-claimer"
import { LEVEL_XP_THRESHOLDS, getLevelCEFR, xpToRoastLevel, type RoastLevel } from "@/lib/level-utils"
import { formatLessonTime } from "@/lib/time"
import { computeLessonAccess } from "@/lib/lesson-access"

// Не кешируем — секунды у openAt/closeAt должны пересчитываться на каждый запрос.
export const dynamic = "force-dynamic"

const LEVEL_ORDER = ["Raw", "Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"] as const
const LEVEL_SHORT: Record<string, string> = {
  Raw: "Raw",
  Rare: "Rare",
  "Medium Rare": "Med Rare",
  Medium: "Medium",
  "Medium Well": "Med Well",
  "Well Done": "Well Done",
}

const STU_CSS = `
.stu-home .xp-hero{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px 22px;margin-bottom:16px;display:flex;align-items:center;gap:20px}
.stu-home .xp-hero-left{display:flex;align-items:center;gap:10px;min-width:160px}
.stu-home .xp-hero-emoji{width:42px;height:42px;border-radius:12px;background:rgba(230,57,70,.08);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.stu-home .xp-hero-level{font-family:'Gluten',cursive;font-size:1.2rem;color:var(--red);font-weight:600;line-height:1}
.stu-home .xp-hero-sub{font-size:.62rem;color:var(--muted);margin-top:2px}
.stu-home .xp-hero-bar{flex:1;height:10px;background:var(--bg);border-radius:100px;overflow:hidden}
.stu-home .xp-hero-fill{height:100%;border-radius:100px;background:var(--red);transition:width 1s cubic-bezier(.16,1,.3,1)}
.stu-home .xp-hero-right{display:flex;align-items:center;gap:14px;flex-shrink:0}
.stu-home .xp-hero-count{font-size:.82rem;font-weight:700;color:var(--muted);white-space:nowrap}
.stu-home .xp-hero-count b{color:var(--text)}
.stu-home .xp-hero-streak{display:flex;align-items:center;gap:5px;padding:7px 14px;background:var(--lime);border-radius:100px;font-size:.72rem;font-weight:700;color:#0A0A0A;white-space:nowrap;box-shadow:0 2px 0 rgba(140,180,40,.3)}

.stu-home .main-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.stu-home .main-header h1{font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.1}
.stu-home .main-header h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-home .main-header .sub{font-size:13px;color:var(--muted);margin-top:4px}
.stu-home .header-actions{display:flex;align-items:center;gap:8px}
.stu-home .icon-btn{width:38px;height:38px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;position:relative;color:var(--text);text-decoration:none;line-height:1;padding:0;margin:0;flex-shrink:0;cursor:pointer}
.stu-home .icon-btn:hover{border-color:var(--text)}
.stu-home .icon-btn svg{width:18px;height:18px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.stu-home .icon-btn .notif{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;background:var(--red);color:#fff;border-radius:100px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--surface)}

.stu-home .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stu-home .stat{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px 18px;transition:all .15s}
.stu-home .stat:hover{border-color:var(--text)}
.stu-home .stat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.stu-home .stat-val{font-size:28px;font-weight:800;margin-top:8px;letter-spacing:-1px;line-height:1}
.stu-home .stat-val .gl{font-family:'Gluten',cursive}
.stu-home .stat-val--red{color:var(--red)}
.stu-home .stat-change{font-size:11px;margin-top:8px;color:var(--muted);display:flex;align-items:center;gap:4px}
.stu-home .stat-change.up{color:#22c55e;font-weight:600}
.stu-home .stat--lime{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.stu-home .stat--lime .stat-label{color:#0A0A0A;opacity:.65}
.stu-home .stat--dark{background:#0A0A0A;color:#fff;border-color:#0A0A0A}
.stu-home .stat--dark .stat-label{color:#A0A09A}

.stu-home .main-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:20px}
.stu-home .right-col{display:flex;flex-direction:column;gap:16px}

.stu-home .sch-item{display:flex;align-items:center;gap:12px;padding:12px 8px;border-bottom:1px solid var(--border);border-radius:10px;transition:background .15s}
.stu-home .sch-item:last-child{border-bottom:none}
.stu-home .sch-item:hover{background:var(--surface-2)}
.stu-home .sch-item.active{background:var(--lime);border-bottom-color:transparent;margin:3px 0;color:#0A0A0A;border-radius:12px}
.stu-home .sch-time{width:52px;height:52px;background:var(--bg);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.stu-home .sch-item.active .sch-time{background:var(--accent-dark);color:#fff}
.stu-home .sch-time .t{font-size:13px;font-weight:800;letter-spacing:-.3px}
.stu-home .sch-time .d{font-size:9px;opacity:.7}
.stu-home .sch-info{flex:1;min-width:0}
.stu-home .sch-info h4{font-size:13px;font-weight:700}
.stu-home .sch-info p{font-size:11px;color:var(--muted);margin-top:1px}
.stu-home .sch-item.active .sch-info p{color:rgba(0,0,0,.5)}
.stu-home .sch-status{font-size:11px;font-weight:600;padding:4px 10px;border-radius:100px}
.stu-home .sch-status--done{background:rgba(34,197,94,.1);color:#22c55e}
.stu-home .sch-status--pending{color:var(--muted)}
.stu-home .sch-status--cancel{background:rgba(230,57,70,.08);color:var(--red)}
.stu-home .sch-empty{padding:30px 20px;text-align:center;color:var(--muted);font-size:13px}

.stu-home .sch-link{display:block;text-decoration:none;color:inherit}
.stu-home .sch-link:hover{background:var(--surface-2)}
.stu-home .sch-link.active:hover{background:var(--lime);filter:brightness(.96)}

.stu-today-join{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;background:var(--lime);color:#0A0A0A;font-size:12px;font-weight:800;text-decoration:none;border:none;transition:all .15s;white-space:nowrap;box-shadow:0 2px 0 rgba(140,180,40,.3)}
.stu-today-join:hover{background:#b7e316;transform:translateY(-1px)}
.stu-today-join--waiting{background:var(--bg);color:var(--muted);cursor:not-allowed;box-shadow:none;border:1px solid var(--border);font-weight:700}
.stu-today-join--waiting:hover{background:var(--bg);transform:none}
.stu-today-join--expired{background:var(--bg);color:var(--muted);cursor:not-allowed;box-shadow:none;border:1px solid var(--border);font-weight:700}
.stu-today-join--cancelled{background:rgba(230,57,70,.08);color:var(--red);cursor:not-allowed;box-shadow:none;border:1px solid rgba(230,57,70,.2);font-weight:700}
.stu-today-hint{font-size:10px;color:var(--muted);margin-top:3px;text-align:right}

.stu-home .streak-cal{display:flex;gap:4px;margin-top:10px}
.stu-home .streak-day{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
.stu-home .streak-dot{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.stu-home .streak-dot--done{background:var(--lime);color:#0A0A0A}
.stu-home .streak-dot--today{background:var(--red);color:#fff;box-shadow:0 0 12px rgba(230,57,70,.2)}
.stu-home .streak-dot--future{background:var(--bg);color:var(--muted);border:1px dashed var(--border)}
.stu-home .streak-dot--miss{background:var(--bg);color:var(--muted);border:1px solid var(--border)}
.stu-home .streak-label{font-size:9px;color:var(--muted);font-weight:600}

.stu-home .quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.stu-home .quick-card{padding:14px;border-radius:14px;text-align:center;transition:all .2s;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);display:block;text-decoration:none;font-family:inherit}
.stu-home .quick-card:hover{border-color:var(--text);transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow)}
.stu-home .quick-card .qc-icon{font-size:1.3rem;margin-bottom:6px}
.stu-home .quick-card .qc-text{font-size:11px;font-weight:700}
.stu-home .quick-card .qc-sub{font-size:9px;color:var(--muted);margin-top:2px}
.stu-home .quick-card--cta{background:var(--red);border-color:var(--red);color:#fff}
.stu-home .quick-card--cta:hover{background:#d42f3c;border-color:#d42f3c}
.stu-home .quick-card--cta .qc-sub{color:rgba(255,255,255,.6)}

.stu-home .bottom-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}

.stu-home .ach-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
.stu-home .ach{text-align:center;padding:10px 6px;border-radius:12px;transition:all .2s}
.stu-home .ach:hover{background:var(--surface-2)}
.stu-home .ach-icon{font-size:1.4rem;margin-bottom:4px}
.stu-home .ach-name{font-size:9px;font-weight:600;color:var(--text);line-height:1.2}
.stu-home .ach--locked{opacity:.3;filter:grayscale(1)}
.stu-home .ach--locked .ach-name{color:var(--muted)}

.stu-home .lb-row{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:10px;transition:background .15s}
.stu-home .lb-row:hover{background:var(--surface-2)}
.stu-home .lb-row--me{background:rgba(230,57,70,.04);border:1px solid rgba(230,57,70,.08)}
.stu-home .lb-rank{font-size:12px;font-weight:800;color:var(--muted);width:20px;text-align:center}
.stu-home .lb-row--me .lb-rank{color:var(--red)}
.stu-home .lb-avatar{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;overflow:hidden}
.stu-home .lb-av-1{background:var(--lime);color:#0A0A0A}
.stu-home .lb-av-2{background:var(--red);color:#fff}
.stu-home .lb-av-3{background:var(--bg);color:var(--text)}
.stu-home .lb-name{flex:1;font-size:13px;font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stu-home .lb-xp{font-family:'Gluten',cursive;font-size:14px;color:var(--red)}

.stu-home .level-progress{margin-top:12px}
.stu-home .lp-track{display:flex;align-items:center;gap:4px;margin-bottom:8px}
.stu-home .lp-node{flex:1;height:6px;border-radius:100px}
.stu-home .lp-node--done{background:var(--lime)}
.stu-home .lp-node--active{background:linear-gradient(90deg,var(--red),var(--lime));position:relative}
.stu-home .lp-node--active::after{content:'';position:absolute;right:-2px;top:-3px;width:12px;height:12px;border-radius:50%;background:var(--red);border:2px solid var(--surface);box-shadow:0 0 8px rgba(230,57,70,.25)}
.stu-home .lp-node--locked{background:var(--border)}
.stu-home .lp-labels{display:flex;justify-content:space-between}
.stu-home .lp-label{font-size:9px;font-weight:600;color:var(--muted)}
.stu-home .lp-label--active{color:var(--red);font-weight:700}

@media(max-width:1024px){
  .stu-home .stats{grid-template-columns:repeat(2,1fr)}
  .stu-home .bottom-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:900px){
  .stu-home .main-grid{grid-template-columns:1fr}
  .stu-home .bottom-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .stu-home .xp-hero{flex-direction:column;gap:12px;align-items:stretch}
  .stu-home .xp-hero-right{justify-content:space-between}
  .stu-home .stats{grid-template-columns:1fr 1fr}
  .stu-home .stat-val{font-size:22px}
  .stu-home .ach-grid{grid-template-columns:repeat(3,1fr)}
}
`

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfDay(subDays(now, 6))

  // Day of week index (0=Mon .. 6=Sun) — российская неделя
  const weekdayIdx = (d: Date) => (d.getDay() + 6) % 7
  const weekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  const todayIdx = weekdayIdx(now)

  const [profileResult, progressResult, monthLessonsResult, completedMonthResult, todayLessonsResult, achResult, achDefResult, lbResult, xpDailyResult] =
    await Promise.all([
      (supabase as any).from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      (supabase as any).from("user_progress").select("total_xp, english_level, current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
      (supabase as any)
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .gte("scheduled_at", startOfDay(subDays(now, 30)).toISOString()),
      (supabase as any)
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", user.id)
        .eq("status", "completed"),
      (supabase as any)
        .from("lessons")
        .select("id, scheduled_at, duration_minutes, status, jitsi_room_name, teacher_id")
        .eq("student_id", user.id)
        .gte("scheduled_at", todayStart.toISOString())
        .lte("scheduled_at", todayEnd.toISOString())
        .order("scheduled_at", { ascending: true }),
      (supabase as any)
        .from("user_achievements")
        .select("achievement_id, earned_at")
        .eq("user_id", user.id),
      (supabase as any)
        .from("achievement_definitions")
        .select("id, slug, title, icon_emoji, sort_order, rarity")
        .order("sort_order", { ascending: true }),
      (supabase as any).rpc("get_leaderboard", { p_period: "weekly", p_limit: 5 }),
      (supabase as any)
        .from("xp_events")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", weekStart.toISOString()),
    ])

  const profile = profileResult.data as { full_name: string | null } | null
  const progress = progressResult.data as { total_xp: number | null; english_level: string | null; current_streak: number | null; longest_streak: number | null } | null
  const todayLessons = (todayLessonsResult.data ?? []) as Array<{ id: string; scheduled_at: string; duration_minutes: number; status: string; jitsi_room_name: string | null; teacher_id: string | null }>
  const monthLessonsCount = monthLessonsResult.count ?? 0
  const completedMonthCount = completedMonthResult.count ?? 0
  const earnedAchIds = new Set(((achResult.data ?? []) as Array<{ achievement_id: string }>).map((a) => a.achievement_id))
  const achDefsAll = (achDefResult.data ?? []) as Array<{ id: string; slug: string; title: string; icon_emoji: string | null }>
  const achEarned = achDefsAll.filter((a) => earnedAchIds.has(a.id))
  const achLocked = achDefsAll.filter((a) => !earnedAchIds.has(a.id))
  const achDefs = [...achEarned, ...achLocked].slice(0, 8)
  const leaderboard = (lbResult.data ?? []) as Array<{ out_rank: number; out_user_id: string; out_xp: number; out_full_name: string | null; out_avatar_url: string | null }>
  const xpDaily = (xpDailyResult.data ?? []) as Array<{ created_at: string }>

  const fullName = profile?.full_name ?? "Ученик"
  const firstName = fullName.split(" ")[0]
  const xp = progress?.total_xp ?? 0
  const level: RoastLevel = xpToRoastLevel(xp)
  const thresholds = LEVEL_XP_THRESHOLDS[level]
  const currentStreak = progress?.current_streak ?? 0
  const longestStreak = progress?.longest_streak ?? 0
  const levelIndex = LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number])
  const xpInLevel = Math.max(0, xp - thresholds.min)
  const xpLevelSpan = thresholds.next === null ? 0 : thresholds.next - thresholds.min
  const xpPct = thresholds.next === null
    ? 100
    : Math.min(100, Math.round((xpInLevel / Math.max(xpLevelSpan, 1)) * 100))

  const myRank = leaderboard.find((r) => r.out_user_id === user.id)?.out_rank
  const totalOnLb = leaderboard.length

  // streak dots: indexed 0..6 (Mon..Sun) for last 7 days ending today
  const activeDays = new Set<number>()
  for (const e of xpDaily) {
    const d = new Date(e.created_at)
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 6) {
      activeDays.add(weekdayIdx(d))
    }
  }

  // Teachers for today's lessons
  const teacherIds = Array.from(new Set(todayLessons.map((l) => l.teacher_id).filter(Boolean))) as string[]
  let teacherMap: Record<string, { full_name: string | null }> = {}
  if (teacherIds.length) {
    const { data: teachersRaw } = await (supabase as any)
      .from("teacher_profiles")
      .select("id, profile_id")
      .in("id", teacherIds)
    const teachers = (teachersRaw ?? []) as Array<{ id: string; profile_id: string }>
    const profileIds = teachers.map((t) => t.profile_id)
    if (profileIds.length) {
      const { data: profilesRaw } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds)
      const pMap = Object.fromEntries(((profilesRaw ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p]))
      for (const t of teachers) teacherMap[t.id] = pMap[t.profile_id] ?? { full_name: null }
    }
  }

  const upcomingLessonId = todayLessons.find((l) => new Date(l.scheduled_at) > now && l.status === "booked")?.id
  const completedTodayCount = todayLessons.filter((l) => l.status === "completed").length
  const remainingTodayCount = todayLessons.filter((l) => ["booked", "in_progress"].includes(l.status)).length

  return (
    <div className="stu-home">
      <style dangerouslySetInnerHTML={{ __html: STU_CSS }} />
      <LandingXpClaimer />

      <div className="main-header">
        <div>
          <h1>Привет, {firstName}! <span className="gl">🔥</span></h1>
          <div className="sub">
            {format(now, "EEEE, d MMMM", { locale: ru })} · Стрик: {currentStreak} {currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"}
            {todayLessons.length > 0 ? ` · ${todayLessons.length} занят${todayLessons.length === 1 ? "ие" : todayLessons.length < 5 ? "ия" : "ий"} сегодня` : ""}
          </div>
        </div>
        <div className="header-actions">
          <Link href="/student/settings" className="icon-btn" aria-label="Настройки">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.46.4.97.41 1.51"/></svg>
          </Link>
        </div>
      </div>

      {/* XP Hero */}
      <div className="xp-hero">
        <div className="xp-hero-left">
          <div className="xp-hero-emoji">🔥</div>
          <div>
            <div className="xp-hero-level">{level}</div>
            <div className="xp-hero-sub">Уровень прожарки</div>
          </div>
        </div>
        <div className="xp-hero-bar"><div className="xp-hero-fill" style={{ width: `${xpPct}%` }} /></div>
        <div className="xp-hero-right">
          <div className="xp-hero-count">
            <b>{xpInLevel.toLocaleString("ru-RU")}</b> / {thresholds.next === null ? "∞" : xpLevelSpan.toLocaleString("ru-RU")} XP
          </div>
          {currentStreak > 0 ? (
            <div className="xp-hero-streak">🔥 {currentStreak} {currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"} подряд</div>
          ) : null}
        </div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Текущий уровень</div>
          <div className="stat-val stat-val--red"><span className="gl">{LEVEL_SHORT[level]}</span></div>
          <div className="stat-change">≈ {getLevelCEFR(level)}</div>
        </div>
        <div className="stat stat--lime">
          <div className="stat-label">Стрик</div>
          <div className="stat-val">{currentStreak} <small style={{ fontSize: 14, fontWeight: 600 }}>{currentStreak === 1 ? "день" : currentStreak < 5 ? "дня" : "дней"}</small></div>
          <div className="stat-change">🔥 Рекорд: {longestStreak}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Уроков за 30 дн.</div>
          <div className="stat-val">{monthLessonsCount}</div>
          <div className="stat-change">{completedMonthCount} завершено</div>
        </div>
        <div className="stat stat--dark">
          <div className="stat-label">Рейтинг</div>
          <div className="stat-val">{myRank ? `#${myRank}` : "—"}</div>
          <div className="stat-change" style={{ color: "#A0A09A" }}>{totalOnLb > 0 ? `из ${totalOnLb}+ учеников` : "нет данных"}</div>
        </div>
      </div>

      {/* Main grid: schedule + right column */}
      <div className="main-grid">
        <div className="card">
          <div className="card-head">
            <h3>Сегодня, {format(now, "d MMMM", { locale: ru })}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href="/student/schedule" className="btn btn-sm btn-outline">Всё расписание</Link>
              <BookingLauncher className="btn btn-sm btn-red">+ Записаться</BookingLauncher>
            </div>
          </div>
          <div className="card-body">
            {todayLessons.length === 0 ? (
              <div className="sch-empty">На сегодня уроков нет. Запишись на следующий слот 👆</div>
            ) : (
              todayLessons.map((l) => {
                const dt = new Date(l.scheduled_at)
                const teacher = l.teacher_id ? teacherMap[l.teacher_id]?.full_name : null

                // Окно доступа
                const access = computeLessonAccess({
                  scheduledAt: l.scheduled_at,
                  durationMinutes: l.duration_minutes ?? 50,
                  status: l.status,
                })
                const secondsUntilOpen = Math.max(0, Math.floor((access.openAtMs - access.nowMs) / 1000))
                const minutesUntilOpen = Math.ceil(secondsUntilOpen / 60)

                const isLive = access.status === "live" && l.status !== "completed" && l.status !== "cancelled"
                const isSoon = access.status === "waiting" && secondsUntilOpen <= 600 && l.status !== "cancelled"
                const isActive = isLive // подсветка ячейки только когда реально «идёт»
                const lessonHref = `/student/lesson/${l.id}`

                // CTA в правом углу строки
                let cta: any
                if (l.status === "completed") {
                  cta = <span className="sch-status sch-status--done">✓ завершён</span>
                } else if (l.status === "cancelled" || access.status === "cancelled") {
                  cta = <span className="stu-today-join stu-today-join--cancelled">Отменён</span>
                } else if (isLive) {
                  cta = <span className="stu-today-join">Зайти в урок →</span>
                } else if (isSoon) {
                  cta = (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span className="stu-today-join stu-today-join--waiting">Скоро откроется</span>
                      <span className="stu-today-hint">через {minutesUntilOpen} мин</span>
                    </div>
                  )
                } else if (access.status === "expired") {
                  cta = <span className="stu-today-join stu-today-join--expired">Урок завершён</span>
                } else {
                  cta = <span className="sch-status sch-status--pending">{formatLessonTime(dt)}</span>
                }

                // Вся строка кликабельная, если можно войти/скоро открывается
                const clickable = isLive || isSoon
                const rowClass = `sch-item${isActive ? " active" : ""}`
                const rowInner = (
                  <>
                    <div className="sch-time">
                      <div className="t">{formatLessonTime(dt)}</div>
                      <div className="d">{l.duration_minutes} мин</div>
                    </div>
                    <div className="sch-info">
                      <h4>Урок 1-on-1</h4>
                      <p>{teacher ? `с ${teacher}` : "Преподаватель назначен"}</p>
                    </div>
                    {cta}
                  </>
                )

                return clickable ? (
                  <Link
                    key={l.id}
                    href={lessonHref}
                    className={`sch-link ${rowClass}${isActive ? "" : ""}`}
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    {rowInner}
                  </Link>
                ) : (
                  <div key={l.id} className={rowClass}>
                    {rowInner}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="right-col">
          <div className="card">
            <div className="card-head"><h3>Быстрые действия</h3></div>
            <div className="card-body">
              <QuickActions clubsThisWeek={0} newMaterials={0} />
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Стрик этой недели</h3></div>
            <div className="card-body">
              <div className="streak-cal">
                {weekdayLabels.map((lbl, idx) => {
                  const isToday = idx === todayIdx
                  const isFuture = idx > todayIdx
                  const isDone = activeDays.has(idx) && !isToday
                  const cls = isToday
                    ? "streak-dot streak-dot--today"
                    : isFuture
                    ? "streak-dot streak-dot--future"
                    : isDone
                    ? "streak-dot streak-dot--done"
                    : "streak-dot streak-dot--miss"
                  const inner = isToday ? "🔥" : isDone ? "✓" : ""
                  return (
                    <div key={lbl} className="streak-day">
                      <div className={cls}>{inner}</div>
                      <div className="streak-label">{lbl}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="bottom-grid">
        <div className="card">
          <div className="card-head"><h3>Прогресс прожарки</h3></div>
          <div className="card-body">
            <div className="level-progress">
              <div className="lp-track">
                {LEVEL_ORDER.map((_, i) => {
                  const cls = i < levelIndex ? "lp-node lp-node--done" : i === levelIndex ? "lp-node lp-node--active" : "lp-node lp-node--locked"
                  return <div key={i} className={cls} />
                })}
              </div>
              <div className="lp-labels">
                {LEVEL_ORDER.map((lvl, i) => (
                  <span key={lvl} className={`lp-label${i === levelIndex ? " lp-label--active" : ""}`}>{LEVEL_SHORT[lvl]}</span>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {thresholds.nextLevel ? `${xpInLevel.toLocaleString("ru-RU")} / ${xpLevelSpan.toLocaleString("ru-RU")} XP до ${thresholds.nextLevel}` : "Максимальный уровень 🏆"}
              </span>
              <span className="btn btn-sm btn-lime">{xpPct}%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Ачивки</h3><Link href="/student/achievements" className="btn btn-sm btn-outline">Все</Link></div>
          <div className="card-body">
            {achDefs.length === 0 ? (
              <div className="sch-empty">Пока нет достижений</div>
            ) : (
              <div className="ach-grid">
                {achDefs.map((a) => {
                  const earned = earnedAchIds.has(a.id)
                  return (
                    <div key={a.id} className={`ach${earned ? "" : " ach--locked"}`}>
                      <div className="ach-icon">{a.icon_emoji ?? "🏆"}</div>
                      <div className="ach-name">{a.title}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Лидерборд</h3><Link href="/student/leaderboard" className="btn btn-sm btn-outline">Все</Link></div>
          <div className="card-body">
            {leaderboard.length === 0 ? (
              <div className="sch-empty">Лидерборд пуст</div>
            ) : (
              leaderboard.map((r, i) => {
                const isMe = r.out_user_id === user.id
                const avCls = i === 0 ? "lb-av-1" : i === 1 ? "lb-av-2" : "lb-av-3"
                const name = r.out_full_name ?? "—"
                const initials = name.split(" ").filter(Boolean).map((s) => s[0]).join("").toUpperCase().slice(0, 2)
                return (
                  <div key={r.out_user_id} className={`lb-row${isMe ? " lb-row--me" : ""}`}>
                    <div className="lb-rank">{r.out_rank}</div>
                    <div className={`lb-avatar ${avCls}`}>
                      {r.out_avatar_url ? <img src={r.out_avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials || "?"}
                    </div>
                    <div className="lb-name">{isMe ? `${name.split(" ")[0]} (ты)` : name}</div>
                    <div className="lb-xp">{r.out_xp.toLocaleString("ru-RU")}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
