// @ts-nocheck
import { redirect } from "next/navigation"
import { addMonths, differenceInDays, endOfMonth, format, isFuture, startOfMonth, subMonths } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"

const CSS = `
.tch-pay{max-width:1200px;margin:0 auto}
.tch-pay .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-pay .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-pay .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-pay .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-pay .btn:active{transform:scale(.97)}
.tch-pay .btn-sm{padding:6px 14px;font-size:12px}
.tch-pay .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-pay .btn-secondary:hover{border-color:var(--text)}
.tch-pay .btn-primary{background:var(--accent-dark);color:#fff}
.tch-pay .btn-primary:hover{background:var(--red)}
.tch-pay .btn-lime{background:var(--lime);color:#0A0A0A;font-weight:800}
.tch-pay .btn-lime:hover{filter:brightness(.95)}

/* NEXT PAYOUT HERO */
.tch-pay .next-payout{background:var(--accent-dark);color:#fff;border-radius:20px;padding:28px 32px;margin-bottom:22px;display:grid;grid-template-columns:1.3fr 1fr;gap:28px;align-items:center;position:relative;overflow:hidden}
[data-theme="dark"] .tch-pay .next-payout{background:var(--red)}
.tch-pay .next-payout::before{content:'';position:absolute;top:-50%;right:-10%;width:50%;height:200%;background:radial-gradient(ellipse,rgba(216,242,106,.18),transparent 60%);pointer-events:none}
[data-theme="dark"] .tch-pay .next-payout::before{background:radial-gradient(ellipse,rgba(0,0,0,.2),transparent 60%)}
.tch-pay .np-label{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--lime);font-weight:800;margin-bottom:12px;position:relative}
[data-theme="dark"] .tch-pay .np-label{color:#fff;opacity:.8}
.tch-pay .np-amount{font-size:48px;font-weight:800;letter-spacing:-1.5px;line-height:1;position:relative;font-variant-numeric:tabular-nums}
.tch-pay .np-amount small{font-size:18px;color:rgba(255,255,255,.45);font-weight:500;margin-left:6px}
.tch-pay .np-when{font-size:14px;color:rgba(255,255,255,.65);margin-top:10px;position:relative}
.tch-pay .np-when b{color:var(--lime);font-weight:700}
[data-theme="dark"] .tch-pay .np-when b{color:#fff}
.tch-pay .np-actions{margin-top:18px;display:flex;gap:10px;position:relative;flex-wrap:wrap}
.tch-pay .np-details{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px;position:relative}
.tch-pay .np-det-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px}
.tch-pay .np-det-row + .np-det-row{border-top:1px solid rgba(255,255,255,.08)}
.tch-pay .np-det-k{color:rgba(255,255,255,.5);font-weight:600}
.tch-pay .np-det-v{font-weight:700;font-variant-numeric:tabular-nums}
.tch-pay .np-det-total{margin-top:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,.2);display:flex;justify-content:space-between;font-size:14px;font-weight:800}
.tch-pay .np-det-total .v{color:var(--lime)}
[data-theme="dark"] .tch-pay .np-det-total .v{color:#fff}

/* STATS */
.tch-pay .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.tch-pay .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s}
.tch-pay .stat-card:hover{border-color:var(--text)}
.tch-pay .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-pay .stat-card .value{font-size:28px;font-weight:800;margin-top:10px;letter-spacing:-.7px;line-height:1;font-variant-numeric:tabular-nums}
.tch-pay .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-pay .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-pay .stat-card .change.positive{color:#22c55e;font-weight:600}
.tch-pay .stat-card.accent{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.tch-pay .stat-card.accent .label{color:#0A0A0A;opacity:.7}
.tch-pay .stat-card.accent .value small{color:rgba(10,10,10,.6)}
.tch-pay .stat-card.accent .change{color:#0A0A0A;opacity:.85}

/* CARD */
.tch-pay .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:22px}
.tch-pay .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px}
.tch-pay .card-header h3{font-size:18px;font-weight:800;letter-spacing:-.3px}

/* CHART */
.tch-pay .chart-pad{padding:20px 22px}
.tch-pay .chart-top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.tch-pay .chart-total{font-size:32px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums}
.tch-pay .chart-total small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-pay .chart-period{font-size:12px;color:var(--muted);font-weight:600}
.tch-pay .bar-chart{display:flex;align-items:flex-end;gap:10px;height:160px;padding-top:10px}
.tch-pay .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}
.tch-pay .bar{width:100%;background:var(--bg);border-radius:6px 6px 0 0;min-height:8px;transition:all .2s;position:relative}
.tch-pay .bar.lime{background:var(--lime)}
.tch-pay .bar-label{font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.tch-pay .bar.lime + .bar-label{color:var(--text);font-weight:800}

/* TABLE */
.tch-pay .payouts-table{width:100%;border-collapse:collapse}
.tch-pay .payouts-table th{text-align:left;padding:12px 22px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap}
.tch-pay .payouts-table td{padding:14px 22px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tch-pay .payouts-table tr:last-child td{border-bottom:none}
.tch-pay .payouts-table tbody tr{transition:background .15s}
.tch-pay .payouts-table tbody tr:hover{background:var(--surface-2)}
.tch-pay .pt-date{font-weight:700}
.tch-pay .pt-date-sub{font-size:11px;color:var(--muted);margin-top:2px;font-weight:500}
.tch-pay .pt-amount{font-size:15px;font-weight:800;letter-spacing:-.3px;font-variant-numeric:tabular-nums;white-space:nowrap}
.tch-pay .pt-amount.income{color:#22c55e}
.tch-pay .pt-method{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600}
.tch-pay .pt-method-ico{width:28px;height:20px;border-radius:4px;background:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--muted);flex-shrink:0}
.tch-pay .pt-status{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;text-transform:uppercase;letter-spacing:.4px}
.tch-pay .pt-status-paid{background:rgba(34,197,94,.1);color:#22c55e}
.tch-pay .pt-status-processing{background:rgba(245,158,11,.12);color:#B8860B}
.tch-pay .pt-status-scheduled{background:var(--bg);color:var(--muted);border:1px solid var(--border)}

/* METHODS */
.tch-pay .methods-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:18px 22px}
.tch-pay .method-card{background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px;transition:all .15s;position:relative}
.tch-pay .method-card.primary{border-color:var(--accent-dark);background:var(--surface)}
[data-theme="dark"] .tch-pay .method-card.primary{border-color:var(--red)}
.tch-pay .method-card.primary::after{content:'По умолчанию';position:absolute;top:12px;right:12px;padding:3px 8px;background:var(--accent-dark);color:#fff;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.3px}
[data-theme="dark"] .tch-pay .method-card.primary::after{background:var(--red)}
.tch-pay .method-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.tch-pay .method-logo{width:40px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
.tch-pay .method-logo.tinkoff{background:#FFDD2D;color:#0A0A0A}
.tch-pay .method-logo.sber{background:#21A038;color:#fff}
.tch-pay .method-logo.usdt{background:#26A17B;color:#fff}
.tch-pay .method-name{font-size:13px;font-weight:800}
.tch-pay .method-sub{font-size:11px;color:var(--muted);margin-top:1px}
.tch-pay .method-num{font-size:14px;font-weight:700;font-family:monospace;letter-spacing:1px;color:var(--text);margin-bottom:8px}
.tch-pay .method-foot{font-size:11px;color:var(--muted);display:flex;justify-content:space-between;align-items:center}
.tch-pay .methods-empty{padding:30px 22px;text-align:center;color:var(--muted);font-size:13px}

/* STUDENTS BREAKDOWN */
.tch-pay .sb-list{display:flex;flex-direction:column}
.tch-pay .sb-row{display:flex;align-items:center;gap:14px;padding:12px 22px;border-bottom:1px solid var(--border);transition:background .15s}
.tch-pay .sb-row:last-child{border-bottom:none}
.tch-pay .sb-row:hover{background:var(--surface-2)}
.tch-pay .sb-avatar{width:36px;height:36px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
.tch-pay .sb-avatar.v1{background:var(--red);color:#fff}
.tch-pay .sb-avatar.v2{background:var(--lime);color:#0A0A0A}
.tch-pay .sb-avatar.v3{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-pay .sb-avatar.v3{background:var(--red)}
.tch-pay .sb-info{flex:1;min-width:0}
.tch-pay .sb-name{font-size:13px;font-weight:700}
.tch-pay .sb-meta{font-size:11px;color:var(--muted);margin-top:1px}
.tch-pay .sb-lessons{font-size:12px;color:var(--muted);min-width:70px;text-align:right;white-space:nowrap}
.tch-pay .sb-lessons b{color:var(--text);font-weight:800;font-variant-numeric:tabular-nums}
.tch-pay .sb-amount{font-size:14px;font-weight:800;letter-spacing:-.3px;font-variant-numeric:tabular-nums;min-width:90px;text-align:right;white-space:nowrap}

.tch-pay .empty{padding:40px 22px;text-align:center;color:var(--muted);font-size:14px}

@media(max-width:1200px){.tch-pay .payouts-table th:nth-child(4),.tch-pay .payouts-table td:nth-child(4){display:none}}
@media(max-width:1100px){.tch-pay .stats-grid{grid-template-columns:repeat(2,1fr)}.tch-pay .next-payout{grid-template-columns:1fr}}
@media(max-width:900px){.tch-pay .payouts-table th:nth-child(3),.tch-pay .payouts-table td:nth-child(3){display:none}}
@media(max-width:640px){.tch-pay .dash-hdr h1{font-size:26px}.tch-pay .stats-grid{grid-template-columns:1fr 1fr}.tch-pay .np-amount{font-size:36px}.tch-pay .payouts-table th,.tch-pay .payouts-table td{padding:10px 14px}}
`

const PLATFORM_COMMISSION_RATE = 0.22 // 22% platform fee — matches prototype example (12 450/56 400 ≈ 22%)

function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100)
  return rub.toLocaleString("ru-RU")
}

function pluralLessons(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "урок"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "урока"
  return "уроков"
}

function pluralDays(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "день"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня"
  return "дней"
}

function avatarVariant(idx: number): "v1" | "v2" | "v3" {
  return (["v1", "v2", "v3"] as const)[idx % 3]
}

function initials(name: string | null | undefined): string {
  if (!name) return "??"
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??"
}

function getLevelShort(lvl: string | null | undefined): string {
  if (!lvl) return "—"
  const map: Record<string, string> = {
    Raw: "A1 · Raw",
    Rare: "A2 · Rare",
    "Medium Rare": "B1 · M.Rare",
    Medium: "B1 · Medium",
    "Medium Well": "B2 · M.Well",
    "Well Done": "C1 · Well-done",
  }
  return map[lvl] ?? lvl
}

export default async function TeacherPayoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any).from("profiles").select("*").eq("id", user.id).single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  const { data: teacherProfile } = await (supabase as any)
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  const teacherId = teacherProfile?.id ?? ""
  const rating = Number(teacherProfile?.rating ?? 0)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(subMonths(now, 1))
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const twelveMonthsStart = startOfMonth(subMonths(now, 11))

  // Current month completed lessons (for earnings detail)
  const { data: monthLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, price, student_id, duration_minutes")
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .gte("scheduled_at", monthStart.toISOString())
    .lte("scheduled_at", monthEnd.toISOString())
  const monthLessons = (monthLessonsRaw ?? []) as Array<{ id: string; price: number | null; student_id: string; duration_minutes: number | null }>

  const monthGrossKopecks = monthLessons.reduce((s, l) => s + Number(l.price ?? 0), 0)
  const monthLessonCount = monthLessons.length
  const monthAvgPriceKopecks = monthLessonCount > 0 ? Math.round(monthGrossKopecks / monthLessonCount) : 0
  const ratingBonusKopecks = rating >= 4.8 ? Math.round(monthGrossKopecks * 0.1) : rating >= 4.5 ? Math.round(monthGrossKopecks * 0.05) : 0
  const commissionKopecks = Math.round(monthGrossKopecks * PLATFORM_COMMISSION_RATE)
  const nextPayoutKopecks = Math.max(0, monthGrossKopecks + ratingBonusKopecks - commissionKopecks)

  // Previous month for delta
  const { data: prevMonthLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("price")
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .gte("scheduled_at", prevMonthStart.toISOString())
    .lte("scheduled_at", prevMonthEnd.toISOString())
  const prevMonthGrossKopecks = (prevMonthLessonsRaw ?? []).reduce((s: number, l: any) => s + Number(l.price ?? 0), 0)
  const monthDeltaPct = prevMonthGrossKopecks > 0
    ? Math.round(((monthGrossKopecks - prevMonthGrossKopecks) / prevMonthGrossKopecks) * 100)
    : null

  // Year stats
  const { data: yearLessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, price, scheduled_at")
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .gte("scheduled_at", yearStart.toISOString())
    .lte("scheduled_at", yearEnd.toISOString())
  const yearLessons = (yearLessonsRaw ?? []) as Array<{ id: string; price: number | null; scheduled_at: string }>
  const yearGrossKopecks = yearLessons.reduce((s, l) => s + Number(l.price ?? 0), 0)
  const yearLessonCount = yearLessons.length
  const avgPerLessonKopecks = yearLessonCount > 0 ? Math.round(yearGrossKopecks / yearLessonCount) : 0

  // 12 months for chart + history
  const { data: last12LessonsRaw } = await (supabase as any)
    .from("lessons")
    .select("id, price, scheduled_at, student_id")
    .eq("teacher_id", teacherId)
    .eq("status", "completed")
    .gte("scheduled_at", twelveMonthsStart.toISOString())
    .lte("scheduled_at", monthEnd.toISOString())
  const last12Lessons = (last12LessonsRaw ?? []) as Array<{ id: string; price: number | null; scheduled_at: string; student_id: string }>

  // Aggregate by month (12 slots, oldest first)
  const monthBuckets: Array<{
    key: string
    date: Date
    label: string
    lessons: number
    grossKopecks: number
    studentCount: number
  }> = []
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i)
    const ms = startOfMonth(d)
    const me = endOfMonth(d)
    const monthLessonsInBucket = last12Lessons.filter((l) => {
      const dt = new Date(l.scheduled_at)
      return dt >= ms && dt <= me
    })
    const gross = monthLessonsInBucket.reduce((s, l) => s + Number(l.price ?? 0), 0)
    const distinctStudents = new Set(monthLessonsInBucket.map((l) => l.student_id)).size
    monthBuckets.push({
      key: format(ms, "yyyy-MM"),
      date: ms,
      label: format(ms, "LLL", { locale: ru }),
      lessons: monthLessonsInBucket.length,
      grossKopecks: gross,
      studentCount: distinctStudents,
    })
  }
  const maxBucketGross = Math.max(...monthBuckets.map((b) => b.grossKopecks), 1)

  // Student breakdown (current month)
  const byStudent = new Map<string, { lessons: number; grossKopecks: number }>()
  for (const l of monthLessons) {
    const prev = byStudent.get(l.student_id) ?? { lessons: 0, grossKopecks: 0 }
    prev.lessons += 1
    prev.grossKopecks += Number(l.price ?? 0)
    byStudent.set(l.student_id, prev)
  }
  const studentIds = Array.from(byStudent.keys())
  const { data: studentProfilesRaw } = studentIds.length
    ? await (supabase as any).from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] }
  const { data: studentProgressRaw } = studentIds.length
    ? await (supabase as any).from("user_progress").select("user_id, english_level").in("user_id", studentIds)
    : { data: [] }
  const profileMap = new Map<string, string | null>()
  ;(studentProfilesRaw ?? []).forEach((p: any) => profileMap.set(p.id, p.full_name))
  const levelMap = new Map<string, string | null>()
  ;(studentProgressRaw ?? []).forEach((p: any) => levelMap.set(p.user_id, p.english_level))

  const students = Array.from(byStudent.entries())
    .map(([id, v]) => ({
      id,
      name: profileMap.get(id) ?? "Ученик",
      level: levelMap.get(id) ?? null,
      lessons: v.lessons,
      grossKopecks: v.grossKopecks,
    }))
    .sort((a, b) => b.lessons - a.lessons || b.grossKopecks - a.grossKopecks)

  // Payout day = 15th of next month (payment for current month's completed lessons)
  const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  const daysUntilPayout = Math.max(0, differenceInDays(nextPayoutDate, now))
  const nextPayoutLabel = format(nextPayoutDate, "d MMMM", { locale: ru })

  // Build history rows: monthBuckets in reverse (newest first), + current month as "scheduled"
  type HistoryRow = {
    key: string
    dateLabel: string
    subLabel: string
    kopecks: number
    lessons: number
    status: "scheduled" | "paid"
  }
  const history: HistoryRow[] = []
  // Current month as "scheduled" row at top
  history.push({
    key: "scheduled",
    dateLabel: nextPayoutLabel,
    subLabel: daysUntilPayout > 0 ? `через ${daysUntilPayout} ${pluralDays(daysUntilPayout)}` : "сегодня",
    kopecks: nextPayoutKopecks,
    lessons: monthLessonCount,
    status: "scheduled",
  })
  // Past months (skip current month which is index 11)
  for (let i = 10; i >= 0; i--) {
    const b = monthBuckets[i]
    if (b.grossKopecks === 0 && b.lessons === 0) continue
    const paidDate = endOfMonth(b.date)
    const daysAgo = differenceInDays(now, paidDate)
    // Approximate teacher share: same formula (bonus not applied to old data unless stored)
    const historicalCommission = Math.round(b.grossKopecks * PLATFORM_COMMISSION_RATE)
    const net = Math.max(0, b.grossKopecks - historicalCommission)
    history.push({
      key: b.key,
      dateLabel: format(paidDate, "d MMMM", { locale: ru }),
      subLabel: daysAgo <= 60 ? `${daysAgo} ${pluralDays(daysAgo)} назад` : "",
      kopecks: net,
      lessons: b.lessons,
      status: "paid",
    })
  }

  const avgMonthGrossKopecks = monthBuckets.length > 0
    ? Math.round(monthBuckets.reduce((s, b) => s + b.grossKopecks, 0) / monthBuckets.length)
    : 0
  const bestMonth = monthBuckets.reduce((best, b) => b.grossKopecks > (best?.grossKopecks ?? -1) ? b : best, null as typeof monthBuckets[number] | null)
  const bestMonthLabel = bestMonth ? format(bestMonth.date, "LLLL", { locale: ru }) : "—"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-pay">
        <div className="dash-hdr">
          <div>
            <h1>Мои <span className="gl">payouts</span></h1>
            <div className="sub">
              Ближайшая: {nextPayoutLabel} · {monthLessonCount} {pluralLessons(monthLessonCount)} в этом месяце
              {rating > 0 ? ` · рейтинг ${rating.toFixed(1)} ★` : ""}
            </div>
          </div>
        </div>

        {/* NEXT PAYOUT HERO */}
        <div className="next-payout">
          <div>
            <div className="np-label">⏱ ближайшая выплата · {nextPayoutLabel}</div>
            <div className="np-amount">{formatRub(nextPayoutKopecks)}<small>₽</small></div>
            <div className="np-when">
              {daysUntilPayout > 0 ? (
                <>через <b>{daysUntilPayout} {pluralDays(daysUntilPayout)}</b> · автоматически на карту по умолчанию</>
              ) : (
                <><b>сегодня</b> · автоматически на карту по умолчанию</>
              )}
            </div>
            <div className="np-actions">
              <button className="btn btn-lime" disabled>Запросить раньше</button>
              <a href="/teacher/settings" className="btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>Сменить способ</a>
            </div>
          </div>
          <div className="np-details">
            <div className="np-det-row">
              <span className="np-det-k">Уроков проведено</span>
              <span className="np-det-v">{monthLessonCount}</span>
            </div>
            <div className="np-det-row">
              <span className="np-det-k">Ставка за урок (средняя)</span>
              <span className="np-det-v">{formatRub(monthAvgPriceKopecks)} ₽</span>
            </div>
            {ratingBonusKopecks > 0 ? (
              <div className="np-det-row">
                <span className="np-det-k">Бонус за рейтинг {rating.toFixed(1)}★</span>
                <span className="np-det-v">+ {formatRub(ratingBonusKopecks)} ₽</span>
              </div>
            ) : null}
            <div className="np-det-row">
              <span className="np-det-k">Комиссия платформы</span>
              <span className="np-det-v">− {formatRub(commissionKopecks)} ₽</span>
            </div>
            <div className="np-det-total">
              <span>Итого к выплате</span>
              <span className="v">{formatRub(nextPayoutKopecks)} ₽</span>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">Заработано за месяц</div>
            <div className="value">{formatRub(monthGrossKopecks - commissionKopecks + ratingBonusKopecks)}<small>₽</small></div>
            <div className={`change ${monthDeltaPct !== null && monthDeltaPct >= 0 ? "positive" : ""}`}>
              {monthDeltaPct === null
                ? "нет данных за март"
                : monthDeltaPct >= 0
                ? `↑ +${monthDeltaPct}% к прошлому месяцу`
                : `↓ ${monthDeltaPct}% к прошлому месяцу`}
            </div>
          </div>
          <div className="stat-card accent">
            <div className="label">Всего за год</div>
            <div className="value">{formatRub(yearGrossKopecks)}<small>₽</small></div>
            <div className="change">с января {now.getFullYear()}</div>
          </div>
          <div className="stat-card">
            <div className="label">Средний чек / урок</div>
            <div className="value">{formatRub(avgPerLessonKopecks)}<small>₽</small></div>
            <div className="change">по {yearLessonCount} {pluralLessons(yearLessonCount)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Уроков за год</div>
            <div className="value">{yearLessonCount}</div>
            <div className="change">≈ {Math.round(yearLessonCount / Math.max(now.getMonth() + 1, 1))} / месяц</div>
          </div>
        </div>

        {/* CHART */}
        <div className="card">
          <div className="card-header">
            <h3>Заработок по месяцам</h3>
          </div>
          <div className="chart-pad">
            <div className="chart-top">
              <div>
                <div className="chart-total">
                  {formatRub(monthBuckets.reduce((s, b) => s + b.grossKopecks, 0))}
                  <small>₽ за 12 месяцев</small>
                </div>
                <div className="chart-period" style={{ marginTop: 4 }}>
                  средний доход: {formatRub(avgMonthGrossKopecks)} ₽ / месяц · лучший: {bestMonthLabel}
                </div>
              </div>
            </div>
            <div className="bar-chart">
              {monthBuckets.map((b, idx) => {
                const pct = Math.max(4, Math.round((b.grossKopecks / maxBucketGross) * 100))
                const isCurrent = idx === monthBuckets.length - 1
                return (
                  <div className="bar-col" key={b.key}>
                    <div className={`bar${isCurrent ? " lime" : ""}`} style={{ height: `${pct}%` }} title={`${b.label}: ${formatRub(b.grossKopecks)} ₽`} />
                    <div className="bar-label">{b.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* HISTORY */}
        <div className="card">
          <div className="card-header">
            <h3>История выплат</h3>
          </div>
          {history.length === 0 ? (
            <div className="empty">Пока нет выплат</div>
          ) : (
            <table className="payouts-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Сумма</th>
                  <th>Уроков</th>
                  <th>Способ</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <div className="pt-date">{row.dateLabel}</div>
                      {row.subLabel ? <div className="pt-date-sub">{row.subLabel}</div> : null}
                    </td>
                    <td>
                      <div className={`pt-amount${row.status === "paid" ? " income" : ""}`}>{formatRub(row.kopecks)} ₽</div>
                    </td>
                    <td>{row.lessons}</td>
                    <td>
                      <span className="pt-method">
                        <span className="pt-method-ico">—</span>
                        не настроен
                      </span>
                    </td>
                    <td>
                      {row.status === "scheduled" ? (
                        <span className="pt-status pt-status-scheduled">запланировано</span>
                      ) : (
                        <span className="pt-status pt-status-paid">✓ выплачено</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* STUDENTS BREAKDOWN */}
        <div className="card">
          <div className="card-header">
            <h3>Откуда выручка · {format(now, "LLLL", { locale: ru })}</h3>
            <a href="/teacher/students" className="btn btn-sm btn-secondary">Все ученики</a>
          </div>
          {students.length === 0 ? (
            <div className="empty">В этом месяце ещё нет завершённых уроков</div>
          ) : (
            <div className="sb-list">
              {students.map((s, idx) => (
                <div className="sb-row" key={s.id}>
                  <div className={`sb-avatar ${avatarVariant(idx)}`}>{initials(s.name)}</div>
                  <div className="sb-info">
                    <div className="sb-name">{s.name}</div>
                    <div className="sb-meta">{getLevelShort(s.level)}</div>
                  </div>
                  <div className="sb-lessons"><b>{s.lessons}</b> {pluralLessons(s.lessons)}</div>
                  <div className="sb-amount">{formatRub(s.grossKopecks)} ₽</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAYMENT METHODS */}
        <div className="card">
          <div className="card-header">
            <h3>Способы получения</h3>
            <a href="/teacher/settings" className="btn btn-sm btn-secondary">+ Добавить</a>
          </div>
          <div className="methods-empty">
            Способы выплат пока не настроены. Зайди в <a href="/teacher/settings" style={{ color: "var(--text)", fontWeight: 700 }}>Настройки</a>, чтобы привязать карту или криптокошелёк.
          </div>
        </div>
      </div>
    </>
  )
}
