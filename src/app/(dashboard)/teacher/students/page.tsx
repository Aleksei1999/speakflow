// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import TeacherStudentsClient from "./TeacherStudentsClient"

// Не кешируем — список учеников / avatar_url должны быть свежими (миграция 048
// бэкфилит OAuth-аватары, а старый snapshot мог содержать NULL).
export const dynamic = "force-dynamic"

const CSS = `
.tch-std{max-width:1200px;margin:0 auto}
.tch-std .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-std .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-std .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-std .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-std .btn:active{transform:scale(.97)}
.tch-std .btn:disabled{opacity:.55;cursor:not-allowed}
.tch-std .btn-sm{padding:6px 14px;font-size:12px}
.tch-std .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-std .btn-secondary:hover{border-color:var(--text)}
.tch-std .btn-primary{background:var(--accent-dark);color:#fff}
.tch-std .btn-primary:hover{background:var(--red)}

/* STATS */
.tch-std .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.tch-std .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s ease}
.tch-std .stat-card:hover{border-color:var(--text)}
.tch-std .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-std .stat-card .value{font-size:32px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1}
.tch-std .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-std .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-std .stat-card .change.positive{color:#22c55e;font-weight:600}
.tch-std .stat-card .change.warning{color:#F59E0B;font-weight:600}
.tch-std .stat-card.accent{background:var(--lime);border-color:var(--lime);color:#0A0A0A}
.tch-std .stat-card.accent .label{color:#0A0A0A;opacity:.7}

/* CARD */
.tch-std .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:background .2s ease,border-color .2s ease}
.tch-std .card-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px}
.tch-std .card-header h3{font-size:18px;font-weight:800;letter-spacing:-.3px}
.tch-std .card-header .sort-label{font-size:12px;color:var(--muted)}
.tch-std .card-body{padding:4px 0 0}

/* FILTERS BAR */
.tch-std .filters-bar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.tch-std .search-input{flex:1;min-width:220px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>");background-repeat:no-repeat;background-position:12px center;background-size:16px}
.tch-std .search-input:focus{outline:none;border-color:var(--text)}
.tch-std .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px;flex-wrap:wrap}
.tch-std .filter-tabs button{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;border:none;background:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tch-std .filter-tabs button:hover{color:var(--text)}
.tch-std .filter-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .filter-tabs button.active{background:var(--red)}
.tch-std .filter-tabs .pill-count{background:rgba(0,0,0,.08);color:inherit;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .tch-std .filter-tabs .pill-count{background:rgba(255,255,255,.08)}
.tch-std .filter-tabs button.active .pill-count{background:rgba(255,255,255,.25)}

/* STUDENTS TABLE */
.tch-std .students-table{width:100%;border-collapse:collapse}
.tch-std .students-table th{text-align:left;padding:12px 22px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;border-bottom:1px solid var(--border)}
.tch-std .students-table td{padding:14px 22px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tch-std .students-table tr:last-child td{border-bottom:none}
.tch-std .students-table tbody tr{transition:background .15s}
.tch-std .students-table tbody tr:hover{background:var(--surface-2)}
.tch-std .st-user{display:flex;align-items:center;gap:12px}
.tch-std .st-avatar{width:40px;height:40px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;object-fit:cover;overflow:hidden;color:var(--text)}
.tch-std .st-avatar.red{background:var(--red);color:#fff}
.tch-std .st-avatar.lime{background:var(--lime);color:#0A0A0A}
.tch-std .st-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .st-avatar.dark{background:var(--red)}
/* Hybrid avatar: initials chip under, <img> stretched on top. onError hides
   the <img> and the initials show through — no broken-image icon. */
.tch-std .st-avatar-wrap{position:relative;width:40px;height:40px;flex-shrink:0}
.tch-std .st-avatar-wrap .st-avatar{position:absolute;inset:0;width:100%;height:100%}
.tch-std .st-avatar-wrap img.st-avatar{object-fit:cover;background:var(--bg)}
.tch-std .st-name{font-size:14px;font-weight:700}
.tch-std .st-email{font-size:11px;color:var(--muted);margin-top:1px}

.tch-std .level-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:var(--bg);color:var(--text);white-space:nowrap}
.tch-std .level-pill.rare{background:rgba(230,57,70,.1);color:var(--red)}
.tch-std .level-pill.mrare{background:rgba(216,242,106,.25);color:#5A7A00}
[data-theme="dark"] .tch-std .level-pill.mrare{background:rgba(216,242,106,.15);color:var(--lime)}
.tch-std .level-pill.medium{background:rgba(245,185,66,.15);color:#B8860B}
.tch-std .level-pill.mwell{background:rgba(34,197,94,.1);color:#22c55e}
.tch-std .level-pill.welldone{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-std .level-pill.welldone{background:var(--red)}

.tch-std .progress-mini{display:flex;align-items:center;gap:8px;min-width:120px}
.tch-std .progress-track{flex:1;height:5px;background:var(--bg);border-radius:100px;overflow:hidden;min-width:60px}
.tch-std .progress-fill{height:100%;background:var(--accent-dark);border-radius:100px}
[data-theme="dark"] .tch-std .progress-fill{background:var(--red)}
.tch-std .progress-fill.lime{background:var(--lime)}
.tch-std .progress-label{font-size:11px;font-weight:700;color:var(--muted);min-width:32px;text-align:right}

.tch-std .streak-cell{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:700}
.tch-std .streak-cell .fire{color:var(--red)}

.tch-std .next-lesson{display:flex;flex-direction:column;gap:2px}
.tch-std .next-lesson strong{font-size:12px;font-weight:700}
.tch-std .next-lesson span{font-size:11px;color:var(--muted)}
.tch-std .next-lesson.today strong{color:var(--red)}
.tch-std .next-lesson .muted-dash{font-size:12px;color:var(--muted);font-weight:600}

.tch-std .action-btns{display:flex;gap:6px;justify-content:flex-end}
.tch-std .action-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);transition:all .15s;text-decoration:none}
.tch-std .action-btn:hover{color:var(--text);border-color:var(--text)}
.tch-std .action-btn.primary{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}
.tch-std .action-btn.primary:hover{background:var(--red);border-color:var(--red)}
.tch-std .action-btn.disabled{opacity:.45;cursor:not-allowed}
.tch-std .action-btn.disabled:hover{color:var(--muted);border-color:var(--border)}
.tch-std .action-btn svg{width:14px;height:14px}

.tch-std .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.tch-std .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

/* Responsive */
@media (max-width:1200px){.tch-std .students-table th:nth-child(5),.tch-std .students-table td:nth-child(5){display:none}}
@media (max-width:1100px){.tch-std .stats-grid{grid-template-columns:repeat(2,1fr)}.tch-std .students-table th:nth-child(3),.tch-std .students-table td:nth-child(3){display:none}}
@media (max-width:900px){.tch-std .students-table th:nth-child(4),.tch-std .students-table td:nth-child(4){display:none}}
@media (max-width:640px){.tch-std .dash-hdr h1{font-size:26px}.tch-std .stats-grid{grid-template-columns:1fr 1fr}.tch-std .students-table th:nth-child(2),.tch-std .students-table td:nth-child(2){display:none}}
`

type StudentItem = {
  id: string
  full_name: string
  avatar_url: string | null
  email: string | null
  english_level: string | null
  total_xp: number
  current_streak: number
  lessons_completed: number
  last_lesson_at: string | null
  next_lesson_id: string | null
  next_lesson_at: string | null
  next_lesson_topic: string
  course_progress_pct: number
  needs_attention: boolean
}

type InitialSnapshot = {
  students: StudentItem[]
  counts: Record<string, number>
  stats: {
    total: number
    active_today: number
    avg_progress: number
    needs_attention: number
  }
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  students: [],
  counts: { all: 0, A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
  stats: { total: 0, active_today: 0, avg_progress: 0, needs_attention: 0 },
}

async function loadInitialSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(`${proto}://${host}/api/teacher/students?level=all`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      students: Array.isArray(json.students) ? json.students : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
      stats: { ...EMPTY_SNAPSHOT.stats, ...(json.stats ?? {}) },
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

function pluralStudent(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "ученик"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ученика"
  return "учеников"
}

function pluralLesson(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "урок"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "урока"
  return "уроков"
}

export default async function TeacherStudentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: tp } = await (supabase as any)
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!tp) redirect("/dashboard")

  const snap = await loadInitialSnapshot()
  const s = snap.stats
  const subParts: string[] = []
  subParts.push(`${s.total} активных`)
  if (s.active_today > 0) {
    subParts.push(`${s.active_today} ${pluralLesson(s.active_today)} сегодня`)
  }
  if (s.needs_attention > 0) {
    subParts.push(`${s.needs_attention} требуют внимания`)
  }
  if (s.total === 0) {
    subParts.splice(0, subParts.length, `Пока ${s.total} ${pluralStudent(s.total)}`)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-std">
        <div className="dash-hdr">
          <div>
            <h1>Мои ученики</h1>
            <div className="sub">{subParts.join(" · ")}</div>
          </div>
        </div>
        <TeacherStudentsClient initial={snap} />
      </div>
    </>
  )
}
