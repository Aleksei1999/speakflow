// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import TeacherHomeworkClient from "./TeacherHomeworkClient"

const CSS = `
.tch-hw{max-width:1200px;margin:0 auto}
.tch-hw .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-hw .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-hw .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-hw .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-hw .btn:active{transform:scale(.97)}
.tch-hw .btn:disabled{opacity:.55;cursor:not-allowed}
.tch-hw .btn-sm{padding:6px 14px;font-size:12px}
.tch-hw .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-hw .btn-secondary:hover{border-color:var(--text)}
.tch-hw .btn-primary{background:var(--accent-dark);color:#fff}
.tch-hw .btn-primary:hover{background:var(--red)}
.tch-hw .btn-red{background:var(--red);color:#fff}
.tch-hw .btn-red:hover{background:#c52f3c}
.tch-hw .btn-danger{background:transparent;border:1px solid var(--border);color:var(--muted)}
.tch-hw .btn-danger:hover{color:var(--red);border-color:var(--red)}

/* STATS */
.tch-hw .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.tch-hw .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all .15s}
.tch-hw .stat-card:hover{border-color:var(--text)}
.tch-hw .stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.tch-hw .stat-card .value{font-size:32px;font-weight:800;margin-top:10px;letter-spacing:-1px;line-height:1}
.tch-hw .stat-card .value small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.tch-hw .stat-card .change{font-size:12px;margin-top:10px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-hw .stat-card .change.warning{color:#F59E0B;font-weight:600}
.tch-hw .stat-card.accent{background:var(--red);border-color:var(--red);color:#fff}
.tch-hw .stat-card.accent .label{color:rgba(255,255,255,.7)}
.tch-hw .stat-card.accent .value small{color:rgba(255,255,255,.7)}
.tch-hw .stat-card.accent .change{color:rgba(255,255,255,.85)}
.tch-hw .stat-card.dark{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
.tch-hw .stat-card.dark .label{color:#A0A09A}
.tch-hw .stat-card.dark .change{color:#A0A09A}
[data-theme="dark"] .tch-hw .stat-card.dark{background:var(--surface-2);border-color:var(--border)}

/* FILTERS */
.tch-hw .filters-bar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.tch-hw .search-input{flex:1;min-width:220px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>");background-repeat:no-repeat;background-position:12px center;background-size:16px}
.tch-hw .search-input:focus{outline:none;border-color:var(--text)}
.tch-hw .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px;flex-wrap:wrap}
.tch-hw .filter-tabs button{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;display:inline-flex;align-items:center;gap:6px;border:none;background:none;cursor:pointer}
.tch-hw .filter-tabs button:hover{color:var(--text)}
.tch-hw .filter-tabs button.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-hw .filter-tabs button.active{background:var(--red)}
.tch-hw .filter-tabs .pill-count{background:rgba(0,0,0,.08);color:inherit;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .tch-hw .filter-tabs .pill-count{background:rgba(255,255,255,.08)}
.tch-hw .filter-tabs button.active .pill-count{background:rgba(255,255,255,.25)}

/* HW CARDS */
.tch-hw .hw-list{display:grid;grid-template-columns:1fr;gap:12px}
.tch-hw .hw-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 22px;transition:all .15s;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center}
.tch-hw .hw-card:hover{border-color:var(--text)}
.tch-hw .hw-card.pending{border-left:3px solid var(--red)}
.tch-hw .hw-card.overdue{border-left:3px solid #F59E0B;background:rgba(245,158,11,.04)}
[data-theme="dark"] .tch-hw .hw-card.overdue{background:rgba(245,158,11,.08)}
.tch-hw .hw-card.graded{opacity:.78}

.tch-hw .hw-student{display:flex;align-items:center;gap:12px;min-width:180px}
.tch-hw .hw-avatar{width:44px;height:44px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex-shrink:0;object-fit:cover;overflow:hidden;color:var(--text)}
.tch-hw .hw-avatar.red{background:var(--red);color:#fff}
.tch-hw .hw-avatar.lime{background:var(--lime);color:#0A0A0A}
.tch-hw .hw-avatar.dark{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-hw .hw-avatar.dark{background:var(--red)}
.tch-hw .hw-student-info strong{font-size:14px;font-weight:700;display:block}
.tch-hw .hw-student-info span{font-size:11px;color:var(--muted)}

.tch-hw .hw-body{min-width:0}
.tch-hw .hw-title{font-size:15px;font-weight:700;letter-spacing:-.2px;margin-bottom:6px;line-height:1.3}
.tch-hw .hw-meta{display:flex;gap:14px;font-size:12px;color:var(--muted);flex-wrap:wrap;margin-bottom:8px}
.tch-hw .hw-meta span{display:inline-flex;align-items:center;gap:4px}
.tch-hw .hw-meta svg{width:13px;height:13px}
.tch-hw .hw-meta b{color:var(--text);font-weight:700}
.tch-hw .hw-meta .deadline-warn{color:#F59E0B;font-weight:700}
.tch-hw .hw-meta .deadline-over{color:var(--red);font-weight:700}
.tch-hw .hw-attached{display:flex;gap:6px;flex-wrap:wrap}
.tch-hw .hw-attached .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;background:var(--bg);border-radius:999px;font-size:11px;color:var(--muted);font-weight:600;text-decoration:none}
.tch-hw .hw-attached .chip:hover{color:var(--text)}
.tch-hw .hw-attached .chip svg{width:11px;height:11px}

.tch-hw .hw-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}
.tch-hw .hw-status{padding:5px 12px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;text-transform:uppercase;letter-spacing:.5px}
.tch-hw .hw-status-pending{background:var(--red);color:#fff}
.tch-hw .hw-status-assigned{background:var(--bg);color:var(--muted);border:1px solid var(--border)}
.tch-hw .hw-status-overdue{background:rgba(245,158,11,.15);color:#B8860B}
[data-theme="dark"] .tch-hw .hw-status-overdue{color:#F59E0B}
.tch-hw .hw-status-graded{background:rgba(34,197,94,.1);color:#22c55e}

.tch-hw .hw-score{display:flex;flex-direction:column;align-items:flex-end;font-size:11px;color:var(--muted);min-width:60px;text-align:right}
.tch-hw .hw-score strong{font-family:inherit;font-size:18px;font-weight:800;color:var(--text);letter-spacing:-.3px;line-height:1}
.tch-hw .hw-score.high strong{color:#22c55e}
.tch-hw .hw-score.low strong{color:var(--red)}

.tch-hw .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.tch-hw .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

/* MODALS (custom, no shadcn) */
.tch-hw .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:hwFade .15s ease}
@keyframes hwFade{from{opacity:0}to{opacity:1}}
.tch-hw .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:560px;max-height:90vh;overflow:auto;padding:24px}
.tch-hw .modal-card.wide{max-width:700px}
.tch-hw .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.tch-hw .modal-card .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.tch-hw .field{margin-bottom:14px}
.tch-hw .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tch-hw .field input,.tch-hw .field textarea,.tch-hw .field select{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;transition:border-color .15s}
.tch-hw .field input:focus,.tch-hw .field textarea:focus,.tch-hw .field select:focus{outline:none;border-color:var(--text)}
.tch-hw .field textarea{resize:vertical;min-height:80px}
.tch-hw .field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tch-hw .field-row > .field{margin-bottom:0}
.tch-hw .hint{font-size:11px;color:var(--muted);margin-top:4px}
.tch-hw .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap}
.tch-hw .modal-actions .left{margin-right:auto}

.tch-hw .attach-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.tch-hw .attach-row{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:12px}
.tch-hw .attach-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.tch-hw .attach-row .rm{width:22px;height:22px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer}
.tch-hw .attach-row .rm:hover{color:var(--red);border-color:var(--red)}
.tch-hw .attach-row .rm svg{width:10px;height:10px}

.tch-hw .review-grid{display:grid;grid-template-columns:1fr;gap:14px}
.tch-hw .submission-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 14px;font-size:13px;white-space:pre-wrap;max-height:220px;overflow:auto;color:var(--text)}
.tch-hw .score-presets{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.tch-hw .score-presets button{padding:5px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer}
.tch-hw .score-presets button:hover,.tch-hw .score-presets button.active{color:var(--text);border-color:var(--text)}
.tch-hw .score-presets button.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}
[data-theme="dark"] .tch-hw .score-presets button.active{background:var(--red);border-color:var(--red)}

@media (max-width:1100px){
  .tch-hw .stats-grid{grid-template-columns:repeat(2,1fr)}
  .tch-hw .hw-card{grid-template-columns:1fr;gap:12px}
  .tch-hw .hw-actions{justify-content:flex-end}
}
@media (max-width:640px){
  .tch-hw .dash-hdr h1{font-size:26px}
  .tch-hw .stats-grid{grid-template-columns:1fr 1fr}
  .tch-hw .field-row{grid-template-columns:1fr}
}
`

function pluralTask(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "задание"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "задания"
  return "заданий"
}

type InitialSnapshot = {
  homework: any[]
  counts: Record<string, number>
  stats: {
    last_submitted_at: string | null
    avg_score_10: number | null
  }
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  homework: [],
  counts: { all: 0, submitted: 0, assigned: 0, overdue: 0, reviewed: 0 },
  stats: { last_submitted_at: null, avg_score_10: null },
}

async function loadInitialSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(`${proto}://${host}/api/teacher/homework?status=all&sort=recent`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      homework: Array.isArray(json.homework) ? json.homework : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
      stats: {
        last_submitted_at: json.stats?.last_submitted_at ?? null,
        avg_score_10:
          typeof json.stats?.avg_score_10 === "number"
            ? json.stats.avg_score_10
            : null,
      },
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export default async function TeacherHomeworkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  const snap = await loadInitialSnapshot()
  const c = snap.counts
  const subParts: string[] = []
  if (c.submitted > 0) subParts.push(`${c.submitted} ждут проверки`)
  subParts.push(`${c.assigned} выдано`)
  if (c.overdue > 0) subParts.push(`${c.overdue} просрочено`)
  if (subParts.length === 1 && c.all === 0) {
    subParts[0] = `пока ${c.all} ${pluralTask(c.all)}`
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-hw">
        <div className="dash-hdr">
          <div>
            <h1>Домашние <span className="gl">задания</span></h1>
            <div className="sub">{subParts.join(" · ")}</div>
          </div>
        </div>
        <TeacherHomeworkClient initial={snap} />
      </div>
    </>
  )
}
