import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { createClient } from "@/lib/supabase/server"
import { getLocale } from "@/i18n/locale"
import {
  loadTeacherStudentProfile,
  type StudentProfilePayload,
} from "@/lib/teacher/student-profile"
import {
  formatLessonDayShort,
  formatLessonTime,
  formatLessonDateTimeShort,
} from "@/lib/time"

// Не кешируем — это staff-view, поведение «всегда свежее».
export const dynamic = "force-dynamic"

// ---------------------------------------------------------------
// Scoped CSS (.tch-sp = teacher student profile).
// Те же паттерны, что в TeacherStudentsClient (.tch-std) — единый
// визуальный язык; не зависим от shadcn.
// ---------------------------------------------------------------
const CSS = `
.tch-sp{max-width:1200px;margin:0 auto}
.tch-sp .back-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--muted);text-decoration:none;margin-bottom:14px;transition:color .15s}
.tch-sp .back-link:hover{color:var(--text)}
.tch-sp .back-link svg{width:14px;height:14px}

/* HERO */
.tch-sp .hero{display:flex;align-items:flex-start;gap:18px;padding:22px;background:var(--surface);border:1px solid var(--border);border-radius:18px;margin-bottom:18px;flex-wrap:wrap}
.tch-sp .hero-av{width:72px;height:72px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;color:var(--text);overflow:hidden;flex-shrink:0;border:1px solid var(--border)}
.tch-sp .hero-av img{width:100%;height:100%;object-fit:cover}
.tch-sp .hero-info{flex:1;min-width:240px}
.tch-sp .hero-name{font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1.1}
.tch-sp .hero-email{font-size:13px;color:var(--muted);margin-top:4px;word-break:break-all}
.tch-sp .hero-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
.tch-sp .hero-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;background:var(--bg);border:1px solid var(--border);color:var(--text)}
.tch-sp .hero-pill.lime{background:var(--lime);color:#0A0A0A;border-color:var(--lime)}
.tch-sp .hero-pill.red{background:rgba(182,63,55,.1);color:var(--red);border-color:transparent}
.tch-sp .hero-pill.dark{background:var(--accent-dark);color:#fff;border-color:transparent}
[data-theme="dark"] .tch-sp .hero-pill.dark{background:var(--red)}
.tch-sp .hero-xp{display:flex;align-items:center;gap:10px;margin-top:14px}
.tch-sp .hero-xp-track{flex:1;max-width:280px;height:8px;background:var(--bg);border:1px solid var(--border);border-radius:100px;overflow:hidden}
.tch-sp .hero-xp-fill{height:100%;background:var(--accent-dark);border-radius:100px}
[data-theme="dark"] .tch-sp .hero-xp-fill{background:var(--red)}
.tch-sp .hero-xp-label{font-size:11px;color:var(--muted);font-weight:600}

/* STATS */
.tch-sp .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
.tch-sp .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px}
.tch-sp .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-sp .stat-card .value{font-size:30px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1}
.tch-sp .stat-card .value small{font-size:13px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-sp .stat-card .change{font-size:12px;margin-top:8px;color:var(--muted)}
.tch-sp .stat-card .change.positive{color:#22c55e;font-weight:600}
.tch-sp .stat-card .change.warning{color:#F59E0B;font-weight:600}

/* SECTION CARDS */
.tch-sp .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:16px;overflow:hidden}
.tch-sp .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
.tch-sp .card-header h3{font-size:16px;font-weight:800;letter-spacing:-.3px}
.tch-sp .card-header .meta{font-size:12px;color:var(--muted)}
.tch-sp .card-body{padding:8px 0}

/* LESSON LIST */
.tch-sp .lesson-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.tch-sp .lesson-row:last-child{border-bottom:none}
.tch-sp .lesson-when{display:flex;flex-direction:column;gap:2px;min-width:140px}
.tch-sp .lesson-when strong{font-size:13px;font-weight:700}
.tch-sp .lesson-when span{font-size:11px;color:var(--muted)}
.tch-sp .lesson-status{display:inline-flex;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);border:1px solid var(--border);color:var(--text);white-space:nowrap}
.tch-sp .lesson-status.completed{background:rgba(34,197,94,.1);border-color:transparent;color:#22c55e}
.tch-sp .lesson-status.cancelled{background:rgba(182,63,55,.1);border-color:transparent;color:var(--red)}
.tch-sp .lesson-status.no_show{background:rgba(245,158,11,.1);border-color:transparent;color:#F59E0B}
.tch-sp .lesson-status.in_progress,.tch-sp .lesson-status.booked,.tch-sp .lesson-status.scheduled,.tch-sp .lesson-status.confirmed,.tch-sp .lesson-status.pending_payment{background:var(--accent-dark);color:#fff;border-color:transparent}
[data-theme="dark"] .tch-sp .lesson-status.in_progress,[data-theme="dark"] .tch-sp .lesson-status.booked,[data-theme="dark"] .tch-sp .lesson-status.scheduled,[data-theme="dark"] .tch-sp .lesson-status.confirmed,[data-theme="dark"] .tch-sp .lesson-status.pending_payment{background:var(--red)}
.tch-sp .lesson-cta{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;background:var(--accent-dark);color:#fff;text-decoration:none;border:none;transition:background .15s}
[data-theme="dark"] .tch-sp .lesson-cta{background:var(--red)}
.tch-sp .lesson-cta:hover{background:var(--red)}

/* HISTORY TABLE */
.tch-sp .hist-table{width:100%;border-collapse:collapse}
.tch-sp .hist-table th{text-align:left;padding:10px 22px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border)}
.tch-sp .hist-table td{padding:12px 22px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tch-sp .hist-table tr:last-child td{border-bottom:none}

/* MATERIALS LIST */
.tch-sp .mat-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-bottom:1px solid var(--border)}
.tch-sp .mat-row:last-child{border-bottom:none}
.tch-sp .mat-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.tch-sp .mat-info strong{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tch-sp .mat-info span{font-size:11px;color:var(--muted)}
.tch-sp .mat-shared{font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap}

/* HOMEWORK */
.tch-sp .hw-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.tch-sp .hw-row:last-child{border-bottom:none}
.tch-sp .hw-info{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.tch-sp .hw-info strong{font-size:13px;font-weight:700}
.tch-sp .hw-info span{font-size:11px;color:var(--muted)}
.tch-sp .hw-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tch-sp .hw-grade{font-size:12px;font-weight:700;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:3px 10px}
.tch-sp .hw-grade.good{background:rgba(34,197,94,.1);border-color:transparent;color:#22c55e}

/* ACHIEVEMENTS GRID */
.tch-sp .ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;padding:14px 22px}
.tch-sp .ach-card{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;transition:transform .15s,border-color .15s}
.tch-sp .ach-card:hover{transform:translateY(-2px);border-color:var(--text)}
.tch-sp .ach-icon{width:44px;height:44px;margin:0 auto 8px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);overflow:hidden}
.tch-sp .ach-icon img{width:100%;height:100%;object-fit:cover}
.tch-sp .ach-icon.fallback{background:var(--accent-dark);color:#fff;font-weight:800;font-size:16px;border-color:transparent}
[data-theme="dark"] .tch-sp .ach-icon.fallback{background:var(--red)}
.tch-sp .ach-title{font-size:11px;font-weight:700;color:var(--text);line-height:1.3}
.tch-sp .ach-when{font-size:10px;color:var(--muted);margin-top:4px}

/* EMPTY STATES */
.tch-sp .empty{padding:32px 22px;text-align:center;color:var(--muted);font-size:13px}

/* Responsive */
@media (max-width:1100px){.tch-sp .stats-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.tch-sp .hero-name{font-size:20px}.tch-sp .stat-card .value{font-size:24px}}
`

// ---------------------------------------------------------------
// Helpers (local — server-component-friendly, no client deps)
// ---------------------------------------------------------------

function initialsOf(name: string): string {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const LESSON_STATUS_KEYS: Record<string, string> = {
  pending_payment: "lessonStatusPendingPayment",
  booked: "lessonStatusBooked",
  scheduled: "lessonStatusScheduled",
  confirmed: "lessonStatusConfirmed",
  in_progress: "lessonStatusInProgress",
  completed: "lessonStatusCompleted",
  cancelled: "lessonStatusCancelled",
  no_show: "lessonStatusNoShow",
}

function lessonStatusLabel(
  status: string,
  t: Awaited<ReturnType<typeof getTranslations>>
): string {
  const key = LESSON_STATUS_KEYS[status]
  return key ? t(key) : status
}

const HW_STATUS_KEYS: Record<string, string> = {
  pending: "hwStatusPending",
  in_progress: "hwStatusInProgress",
  submitted: "hwStatusSubmitted",
  reviewed: "hwStatusReviewed",
  overdue: "hwStatusOverdue",
}

function hwStatusLabel(
  status: string,
  t: Awaited<ReturnType<typeof getTranslations>>
): string {
  const key = HW_STATUS_KEYS[status]
  return key ? t(key) : status
}

// Важно: timeZone обязателен. Без него Node (UTC) и браузер (Moscow)
// рендерят разные дни для near-midnight created_at — React ловит как
// hydration mismatch (#418).
const REGISTERED_DATE_FMT_RU = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "long",
  year: "numeric",
})
const REGISTERED_DATE_FMT_EN = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "long",
  year: "numeric",
})

function formatRegisteredDate(iso: string | null, locale: "ru" | "en"): string {
  if (!iso) return "—"
  try {
    const fmt = locale === "en" ? REGISTERED_DATE_FMT_EN : REGISTERED_DATE_FMT_RU
    return fmt.format(new Date(iso))
  } catch {
    return "—"
  }
}

// ---------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------

export default async function TeacherStudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: studentId } = await params

  // UUID-валидация инлайн (без зависимости от zod в RSC — meh, fine).
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      studentId
    )
  ) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Получаем роль вызывающего и (если teacher) его teacher_profiles.id
  // одним round-trip.
  const { data: viewerProfile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  const role: string | undefined = viewerProfile?.role

  if (!role) notFound()
  if (role === "student") {
    // Студенту здесь делать нечего — не палим.
    notFound()
  }

  let teacherProfileId: string | null = null
  if (role === "teacher") {
    const { data: tp } = await (supabase as any)
      .from("teacher_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
    if (!tp) notFound()
    teacherProfileId = tp.id
  }

  const result = await loadTeacherStudentProfile(
    supabase as any,
    role === "admin" ? "admin" : "teacher",
    teacherProfileId,
    studentId
  )
  if (!result.ok) notFound()

  const data: StudentProfilePayload = result.data
  const s = data.stats
  const stu = data.student
  const t = await getTranslations("dashboard.teacher.studentDetail")
  const locale = (await getLocale()) as "ru" | "en"
  const timeLocale = locale === "en" ? "en" : "ru"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-sp">
        <Link href="/teacher/students" className="back-link">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          {t("back")}
        </Link>

        {/* HERO */}
        <div className="hero">
          <div className="hero-av">
            {stu.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stu.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              initialsOf(stu.full_name)
            )}
          </div>
          <div className="hero-info">
            <h1 className="hero-name">
              {stu.full_name}{" "}
              <span className="gl" style={{ fontWeight: 700 }}>
                {t("headingSuffix")}
              </span>
            </h1>
            {stu.email ? <div className="hero-email">{stu.email}</div> : null}
            <div className="hero-meta">
              {stu.cefr ? (
                <span className="hero-pill lime">{stu.cefr}</span>
              ) : null}
              <span className="hero-pill dark">{stu.level}</span>
              <span className="hero-pill">
                🔥 {stu.streak}{" "}
                <span style={{ opacity: 0.7, fontWeight: 600 }}>{t("metaDays")}</span>
              </span>
              <span className="hero-pill">
                {stu.total_xp.toLocaleString(locale === "en" ? "en-US" : "ru-RU")} XP
              </span>
              <span className="hero-pill">
                {t("metaSince", { date: formatRegisteredDate(stu.created_at, locale) })}
              </span>
            </div>
            <div className="hero-xp">
              <div className="hero-xp-track">
                <div
                  className="hero-xp-fill"
                  style={{ width: `${stu.level_progress_pct}%` }}
                />
              </div>
              <div className="hero-xp-label">
                {t("metaXpProgress", { pct: stu.level_progress_pct })}
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label">{t("statTotalLabel")}</div>
            <div className="value">{s.total_lessons}</div>
            <div className="change">{t("statTotalSub")}</div>
          </div>
          <div className="stat-card">
            <div className="label">{t("statCompletedLabel")}</div>
            <div className="value">{s.completed}</div>
            <div className="change positive">
              {s.upcoming_count > 0
                ? t("statCompletedAhead", { count: s.upcoming_count })
                : t("statCompletedNone")}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">{t("statCancelledLabel")}</div>
            <div className="value">{s.cancelled + s.no_show}</div>
            <div className={`change${s.no_show > 0 ? " warning" : ""}`}>
              {t("statCancelledSub", { cancelled: s.cancelled, noShow: s.no_show })}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">{t("statRatingLabel")}</div>
            <div className="value">
              {s.average_rating !== null ? s.average_rating.toFixed(1) : "—"}
              {s.average_rating !== null ? <small>/5</small> : null}
            </div>
            <div
              className={`change${s.needs_attention ? " warning" : " positive"}`}
            >
              {s.needs_attention ? t("statRatingWarn") : t("statRatingOk")}
            </div>
          </div>
        </div>

        {/* UPCOMING */}
        <div className="card">
          <div className="card-header">
            <h3>{t("upcomingTitle")}</h3>
            <div className="meta">{t("upcomingMeta", { count: s.upcoming_count })}</div>
          </div>
          <div className="card-body">
            {data.upcoming.length === 0 ? (
              <div className="empty">{t("upcomingEmpty")}</div>
            ) : (
              data.upcoming.map((l) => (
                <div key={l.id} className="lesson-row">
                  <div className="lesson-when">
                    <strong>
                      {formatLessonDayShort(l.scheduled_at, timeLocale)},{" "}
                      {formatLessonTime(l.scheduled_at, timeLocale)}
                    </strong>
                    <span>{t("minutesShort", { count: l.duration_minutes })}</span>
                  </div>
                  <span className={`lesson-status ${l.status}`}>
                    {lessonStatusLabel(l.status, t)}
                  </span>
                  <Link
                    href={`/teacher/lesson/${l.id}`}
                    className="lesson-cta"
                  >
                    {t("open")}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HISTORY */}
        <div className="card">
          <div className="card-header">
            <h3>{t("historyTitle")}</h3>
            <div className="meta">{t("historyMeta", { count: data.recent.length })}</div>
          </div>
          <div className="card-body">
            {data.recent.length === 0 ? (
              <div className="empty">{t("historyEmpty")}</div>
            ) : (
              <table className="hist-table">
                <thead>
                  <tr>
                    <th>{t("thWhen")}</th>
                    <th>{t("thDuration")}</th>
                    <th>{t("thStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((l) => (
                    <tr key={l.id}>
                      <td>{formatLessonDateTimeShort(l.scheduled_at, timeLocale)}</td>
                      <td>{t("minutesShort", { count: l.duration_minutes })}</td>
                      <td>
                        <span className={`lesson-status ${l.status}`}>
                          {lessonStatusLabel(l.status, t)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* MATERIALS */}
        <div className="card">
          <div className="card-header">
            <h3>{t("materialsTitle")}</h3>
            <div className="meta">{t("materialsMeta", { count: data.materials.length })}</div>
          </div>
          <div className="card-body">
            {data.materials.length === 0 ? (
              <div className="empty">{t("materialsEmpty")}</div>
            ) : (
              data.materials.map((m) => (
                <div key={m.id} className="mat-row">
                  <div className="mat-info">
                    <strong>{m.title}</strong>
                    <span>{m.type || t("materialsType")}</span>
                  </div>
                  <div className="mat-shared">
                    {t("materialsShared", { date: formatLessonDayShort(m.shared_at, timeLocale) })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HOMEWORK */}
        <div className="card">
          <div className="card-header">
            <h3>{t("homeworkTitle")}</h3>
            <div className="meta">{t("homeworkMeta", { count: data.homework.length })}</div>
          </div>
          <div className="card-body">
            {data.homework.length === 0 ? (
              <div className="empty">{t("homeworkEmpty")}</div>
            ) : (
              data.homework.map((h) => (
                <div key={h.id} className="hw-row">
                  <div className="hw-info">
                    <strong>{h.title}</strong>
                    <span>
                      {t("homeworkDue", { date: formatLessonDayShort(h.due_at, timeLocale) })}
                      {h.submitted_at
                        ? t("homeworkSubmitted", { date: formatLessonDayShort(h.submitted_at, timeLocale) })
                        : ""}
                    </span>
                  </div>
                  <div className="hw-meta">
                    <span className={`lesson-status ${h.status}`}>
                      {hwStatusLabel(h.status, t)}
                    </span>
                    {h.grade !== null ? (
                      <span
                        className={`hw-grade${h.grade >= 7 ? " good" : ""}`}
                      >
                        {h.grade}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ACHIEVEMENTS */}
        <div className="card">
          <div className="card-header">
            <h3>{t("achievementsTitle")}</h3>
            <div className="meta">{t("achievementsMeta", { count: data.achievements.length })}</div>
          </div>
          <div className="card-body">
            {data.achievements.length === 0 ? (
              <div className="empty">{t("achievementsEmpty")}</div>
            ) : (
              <div className="ach-grid">
                {data.achievements.map((a) => (
                  <div key={a.slug} className="ach-card">
                    <div className={`ach-icon${a.icon_url ? "" : " fallback"}`}>
                      {a.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.icon_url} alt="" />
                      ) : (
                        (a.title[0] || "?").toUpperCase()
                      )}
                    </div>
                    <div className="ach-title">{a.title}</div>
                    <div className="ach-when">
                      {formatLessonDayShort(a.earned_at, timeLocale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
