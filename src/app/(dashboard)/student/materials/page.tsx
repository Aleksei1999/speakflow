// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import StudentMaterialsClient from "./StudentMaterialsClient"

const CSS = `
.stu-mat{max-width:1200px;margin:0 auto}
.stu-mat .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.stu-mat .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.stu-mat .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.stu-mat .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.stu-mat .btn:active{transform:scale(.97)}
.stu-mat .btn-sm{padding:6px 14px;font-size:12px}
.stu-mat .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.stu-mat .btn-secondary:hover{border-color:var(--text)}
.stu-mat .btn-primary{background:var(--accent-dark);color:#fff}
.stu-mat .btn-primary:hover{background:var(--red)}

.stu-mat .materials-grid{display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:flex-start}

.stu-mat .cat-side{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;position:sticky;top:24px}
.stu-mat .cat-title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:4px 10px 10px}
.stu-mat .cat-list{display:flex;flex-direction:column;gap:2px}
.stu-mat .cat-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;text-align:left;width:100%;border:none;background:none}
.stu-mat .cat-item:hover{background:var(--bg);color:var(--text)}
.stu-mat .cat-item.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .stu-mat .cat-item.active{background:var(--red)}
.stu-mat .cat-item .cat-icon{width:16px;height:16px;flex-shrink:0}
.stu-mat .cat-item .cat-count{margin-left:auto;font-size:11px;opacity:.7;font-weight:700}

.stu-mat .content-area{min-width:0}
.stu-mat .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.stu-mat .search-input{flex:1;min-width:220px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>");background-repeat:no-repeat;background-position:12px center;background-size:16px}
.stu-mat .search-input:focus{outline:none;border-color:var(--text)}
.stu-mat .view-toggle{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:3px}
.stu-mat .view-btn{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:all .15s;border:none;background:none;cursor:pointer}
.stu-mat .view-btn.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .stu-mat .view-btn.active{background:var(--red)}
.stu-mat .view-btn svg{width:15px;height:15px}
.stu-mat .sort-select{height:40px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0 14px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit}

.stu-mat .mat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.stu-mat .mat-list{display:flex;flex-direction:column;gap:8px}
.stu-mat .mat-list .mat-card{flex-direction:row;align-items:center}
.stu-mat .mat-list .mat-thumb{height:72px;width:72px;flex-shrink:0;border-right:1px solid var(--border)}
.stu-mat .mat-list .mat-thumb-icon{width:36px;height:36px;border-radius:10px}
.stu-mat .mat-list .mat-thumb-icon svg{width:18px;height:18px}
.stu-mat .mat-list .mat-type-badge{display:none}
.stu-mat .mat-list .mat-body{padding:10px 14px}
.stu-mat .mat-list .mat-footer{padding-top:8px}

.stu-mat .mat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:all .15s;cursor:pointer;display:flex;flex-direction:column}
.stu-mat .mat-card:hover{border-color:var(--text);transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow-color)}
.stu-mat .mat-list .mat-card:hover{transform:none}

.stu-mat .mat-thumb{height:110px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.stu-mat .mat-thumb-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff}
.stu-mat .mat-thumb-icon svg{width:24px;height:24px}
.stu-mat .mat-thumb-icon.pdf{background:var(--red)}
.stu-mat .mat-thumb-icon.ppt{background:#F59E0B}
.stu-mat .mat-thumb-icon.doc{background:#3B5FE8}
.stu-mat .mat-thumb-icon.video{background:var(--accent-dark)}
[data-theme="dark"] .stu-mat .mat-thumb-icon.video{background:#666}
.stu-mat .mat-thumb-icon.audio{background:#8B5CF6}
.stu-mat .mat-thumb-icon.img{background:var(--lime);color:#0A0A0A}
.stu-mat .mat-thumb-icon.link{background:#06B6D4}

.stu-mat .mat-type-badge{position:absolute;top:8px;left:8px;padding:3px 8px;background:rgba(255,255,255,0.95);color:#0A0A0A;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
[data-theme="dark"] .stu-mat .mat-type-badge{background:rgba(0,0,0,0.7);color:#fff}

.stu-mat .source-badge{position:absolute;top:8px;right:8px;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.3px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stu-mat .source-badge.public{background:rgba(6,182,212,.18);color:#0891B2}
[data-theme="dark"] .stu-mat .source-badge.public{background:rgba(6,182,212,.25);color:#22D3EE}
.stu-mat .source-badge.lesson{background:rgba(59,95,232,.18);color:#2940BA}
[data-theme="dark"] .stu-mat .source-badge.lesson{background:rgba(59,95,232,.25);color:#8AA0FF}
.stu-mat .source-badge.student{background:rgba(230,57,70,.18);color:var(--red)}
.stu-mat .source-badge.group{background:rgba(139,92,246,.18);color:#6D28D9}
[data-theme="dark"] .stu-mat .source-badge.group{background:rgba(139,92,246,.25);color:#A78BFA}
.stu-mat .source-badge.homework{background:rgba(245,158,11,.18);color:#B45309}
[data-theme="dark"] .stu-mat .source-badge.homework{background:rgba(245,158,11,.25);color:#FBBF24}

.stu-mat .mat-body{padding:12px 14px;flex:1;display:flex;flex-direction:column;min-width:0}
.stu-mat .mat-title{font-size:13px;font-weight:700;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.stu-mat .mat-meta{font-size:11px;color:var(--muted);margin-bottom:10px}
.stu-mat .mat-meta b{color:var(--text);font-weight:600}

.stu-mat .mat-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.stu-mat .mat-tag{font-size:10px;padding:2px 8px;background:var(--bg);border-radius:999px;color:var(--muted);font-weight:600}
.stu-mat .mat-tag.level{background:rgba(230,57,70,.08);color:var(--red)}
[data-theme="dark"] .stu-mat .mat-tag.level{background:rgba(230,57,70,.15)}

.stu-mat .mat-footer{margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:6px}
.stu-mat .mat-owner{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px;min-width:0;flex:1;overflow:hidden}
.stu-mat .mat-owner .ow-av{width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0}
.stu-mat .mat-owner .ow-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stu-mat .mat-actions{display:flex;gap:4px}
.stu-mat .mat-btn{width:28px;height:28px;border-radius:7px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);transition:all .15s;cursor:pointer}
.stu-mat .mat-btn:hover{color:var(--text);border-color:var(--text)}
.stu-mat .mat-btn.primary{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}
.stu-mat .mat-btn.primary:hover{background:var(--red);border-color:var(--red)}
.stu-mat .mat-btn svg{width:12px;height:12px}

.stu-mat .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.stu-mat .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

@media (max-width:1100px){
  .stu-mat .materials-grid{grid-template-columns:1fr}
  .stu-mat .cat-side{position:static}
  .stu-mat .cat-list{flex-direction:row;flex-wrap:wrap}
  .stu-mat .cat-item{flex:0 0 auto}
}
@media (max-width:640px){
  .stu-mat .dash-hdr h1{font-size:26px}
  .stu-mat .mat-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
}
`

function pluralFiles(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "файл"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "файла"
  return "файлов"
}

type InitialSnapshot = {
  materials: any[]
  counts: Record<string, number>
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  materials: [],
  counts: {
    all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0,
    "A1-A2": 0, B1: 0, B2: 0, "C1+": 0,
  },
}

async function loadInitialSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(`${proto}://${host}/api/student/materials?type=all&level=all&sort=recent`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      materials: Array.isArray(json.materials) ? json.materials : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export default async function StudentMaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any).from("profiles").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "student") {
    if (profile?.role === "teacher") redirect("/teacher")
    if (profile?.role === "admin") redirect("/admin")
    redirect("/login")
  }

  const snap = await loadInitialSnapshot()
  const totalFiles = Number(snap.counts.all ?? 0)
  const sub = totalFiles > 0
    ? `${totalFiles} ${pluralFiles(totalFiles)} от ваших учителей`
    : "Материалы от твоих учителей появятся здесь"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="stu-mat">
        <div className="dash-hdr">
          <div>
            <h1>Мои материалы</h1>
            <div className="sub">{sub}</div>
          </div>
        </div>
        <StudentMaterialsClient initial={snap} />
      </div>
    </>
  )
}
