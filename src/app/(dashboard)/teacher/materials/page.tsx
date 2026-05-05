// @ts-nocheck
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { format, formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { createClient } from "@/lib/supabase/server"
import TeacherMaterialsClient from "./TeacherMaterialsClient"

const CSS = `
.tch-mat{max-width:1200px;margin:0 auto}
.tch-mat .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-mat .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-mat .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-mat .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-mat .btn:active{transform:scale(.97)}
.tch-mat .btn-sm{padding:6px 14px;font-size:12px}
.tch-mat .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-mat .btn-secondary:hover{border-color:var(--text)}
.tch-mat .btn-primary{background:var(--accent-dark);color:#fff}
.tch-mat .btn-primary:hover{background:var(--red)}

/* LAYOUT */
.tch-mat .materials-grid{display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:flex-start}

/* CATEGORIES SIDEBAR */
.tch-mat .cat-side{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;position:sticky;top:24px}
.tch-mat .cat-title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;padding:4px 10px 10px}
.tch-mat .cat-list{display:flex;flex-direction:column;gap:2px}
.tch-mat .cat-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;text-align:left;width:100%;border:none;background:none}
.tch-mat .cat-item:hover{background:var(--bg);color:var(--text)}
.tch-mat .cat-item.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-mat .cat-item.active{background:var(--red)}
.tch-mat .cat-item .cat-icon{width:16px;height:16px;flex-shrink:0}
.tch-mat .cat-item .cat-count{margin-left:auto;font-size:11px;opacity:.7;font-weight:700}

/* UPLOAD ZONE */
.tch-mat .upload-zone{margin-top:16px;padding:18px;border:2px dashed var(--border);border-radius:14px;text-align:center;cursor:pointer;transition:all .15s;background:var(--surface-2)}
.tch-mat .upload-zone:hover{border-color:var(--text);background:var(--bg)}
.tch-mat .upload-zone.dragging{border-color:var(--red);background:rgba(230,57,70,.06)}
.tch-mat .upload-zone .up-icon{width:36px;height:36px;margin:0 auto 8px;background:var(--surface);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--red)}
.tch-mat .upload-zone .up-text{font-size:13px;font-weight:700;margin-bottom:2px}
.tch-mat .upload-zone .up-sub{font-size:11px;color:var(--muted)}

/* CONTENT AREA */
.tch-mat .content-area{min-width:0}
.tch-mat .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.tch-mat .search-input{flex:1;min-width:220px;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><path d='m21 21-4.35-4.35'/></svg>");background-repeat:no-repeat;background-position:12px center;background-size:16px}
.tch-mat .search-input:focus{outline:none;border-color:var(--text)}
.tch-mat .view-toggle{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:3px}
.tch-mat .view-btn{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);transition:all .15s;border:none;background:none;cursor:pointer}
.tch-mat .view-btn.active{background:var(--accent-dark);color:#fff}
[data-theme="dark"] .tch-mat .view-btn.active{background:var(--red)}
.tch-mat .view-btn svg{width:15px;height:15px}
.tch-mat .sort-select{height:40px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0 14px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;font-family:inherit}

/* MATERIALS GRID */
.tch-mat .mat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.tch-mat .mat-list{display:flex;flex-direction:column;gap:8px}
.tch-mat .mat-list .mat-card{flex-direction:row;align-items:center}
.tch-mat .mat-list .mat-thumb{height:72px;width:72px;flex-shrink:0;border-right:1px solid var(--border)}
.tch-mat .mat-list .mat-thumb-icon{width:36px;height:36px;border-radius:10px}
.tch-mat .mat-list .mat-thumb-icon svg{width:18px;height:18px}
.tch-mat .mat-list .mat-type-badge{display:none}
.tch-mat .mat-list .mat-body{padding:10px 14px}
.tch-mat .mat-list .mat-footer{padding-top:8px}

.tch-mat .mat-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:all .15s;cursor:pointer;display:flex;flex-direction:column}
.tch-mat .mat-card:hover{border-color:var(--text);transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow-color)}
.tch-mat .mat-list .mat-card:hover{transform:none}

.tch-mat .mat-thumb{height:110px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.tch-mat .mat-thumb-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff}
.tch-mat .mat-thumb-icon svg{width:24px;height:24px}
.tch-mat .mat-thumb-icon.pdf{background:var(--red)}
.tch-mat .mat-thumb-icon.ppt{background:#F59E0B}
.tch-mat .mat-thumb-icon.doc{background:#3B5FE8}
.tch-mat .mat-thumb-icon.video{background:var(--accent-dark)}
[data-theme="dark"] .tch-mat .mat-thumb-icon.video{background:#666}
.tch-mat .mat-thumb-icon.audio{background:#8B5CF6}
.tch-mat .mat-thumb-icon.img{background:var(--lime);color:#0A0A0A}
.tch-mat .mat-thumb-icon.link{background:#06B6D4}

.tch-mat .mat-type-badge{position:absolute;top:8px;left:8px;padding:3px 8px;background:rgba(255,255,255,0.95);color:#0A0A0A;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
[data-theme="dark"] .tch-mat .mat-type-badge{background:rgba(0,0,0,0.7);color:#fff}

.tch-mat .mat-body{padding:12px 14px;flex:1;display:flex;flex-direction:column;min-width:0}
.tch-mat .mat-title{font-size:13px;font-weight:700;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tch-mat .mat-meta{font-size:11px;color:var(--muted);margin-bottom:10px}
.tch-mat .mat-meta b{color:var(--text);font-weight:600}

.tch-mat .mat-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.tch-mat .mat-tag{font-size:10px;padding:2px 8px;background:var(--bg);border-radius:999px;color:var(--muted);font-weight:600}
.tch-mat .mat-tag.level{background:rgba(230,57,70,.08);color:var(--red)}
[data-theme="dark"] .tch-mat .mat-tag.level{background:rgba(230,57,70,.15)}

.tch-mat .mat-footer{margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:6px}
.tch-mat .mat-use-count{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px}
.tch-mat .mat-use-count svg{width:11px;height:11px}
.tch-mat .mat-actions{display:flex;gap:4px}
.tch-mat .mat-btn{width:28px;height:28px;border-radius:7px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);transition:all .15s;cursor:pointer}
.tch-mat .mat-btn:hover{color:var(--text);border-color:var(--text)}
.tch-mat .mat-btn.primary{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}
.tch-mat .mat-btn.primary:hover{background:var(--red);border-color:var(--red)}
.tch-mat .mat-btn.danger:hover{color:var(--red);border-color:var(--red)}
.tch-mat .mat-btn svg{width:12px;height:12px}

.tch-mat .section-heading{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:22px 0 10px;display:flex;align-items:center;gap:8px}
.tch-mat .section-heading:first-child{margin-top:0}
.tch-mat .section-heading .line{flex:1;height:1px;background:var(--border)}

.tch-mat .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.tch-mat .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

/* UPLOAD MODAL (custom, to match dark/light theme without shadcn re-theming) */
.tch-mat .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:tchFade .15s ease}
@keyframes tchFade{from{opacity:0}to{opacity:1}}
.tch-mat .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:480px;max-height:90vh;overflow:auto;padding:24px}
.tch-mat .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.tch-mat .modal-card .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}
.tch-mat .field{margin-bottom:14px}
.tch-mat .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tch-mat .field input,.tch-mat .field textarea,.tch-mat .field select{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit;transition:border-color .15s}
.tch-mat .field input:focus,.tch-mat .field textarea:focus,.tch-mat .field select:focus{outline:none;border-color:var(--text)}
.tch-mat .field textarea{resize:vertical;min-height:70px}
.tch-mat .file-pill{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-size:13px;margin-bottom:16px}
.tch-mat .file-pill .fp-icon{width:32px;height:32px;border-radius:8px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tch-mat .file-pill .fp-name{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tch-mat .file-pill .fp-size{color:var(--muted);font-size:12px}
.tch-mat .toggle-row{display:flex;align-items:center;gap:10px;padding:10px 0;margin-bottom:10px}
.tch-mat .toggle-sw{position:relative;width:36px;height:20px;border-radius:999px;background:var(--border);transition:background .15s;cursor:pointer;border:none;flex-shrink:0}
.tch-mat .toggle-sw.on{background:var(--red)}
.tch-mat .toggle-sw::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .15s}
.tch-mat .toggle-sw.on::after{transform:translateX(16px)}
.tch-mat .toggle-lbl{font-size:13px;font-weight:600}
.tch-mat .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}

@media (max-width:1100px){
  .tch-mat .materials-grid{grid-template-columns:1fr}
  .tch-mat .cat-side{position:static}
  .tch-mat .cat-list{flex-direction:row;flex-wrap:wrap}
  .tch-mat .cat-item{flex:0 0 auto}
  .tch-mat .upload-zone{display:none}
}
@media (max-width:640px){
  .tch-mat .dash-hdr h1{font-size:26px}
  .tch-mat .mat-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
}
`

function pluralFiles(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "файл"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "файла"
  return "файлов"
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б"
  const GB = 1024 * 1024 * 1024
  const MB = 1024 * 1024
  const KB = 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} ГБ`
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} МБ`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} КБ`
  return `${bytes} Б`
}

function formatLastAdded(iso: string | null): string {
  if (!iso) return "данных пока нет"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "данных пока нет"
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "сегодня"
  if (diffDays === 1) return "вчера"
  if (diffDays < 30) {
    return formatDistanceToNow(d, { addSuffix: true, locale: ru })
  }
  return format(d, "LLLL yyyy", { locale: ru })
}

type InitialSnapshot = {
  materials: any[]
  counts: Record<string, number>
  storage: { used_bytes: number; total_bytes: number }
  last_uploaded_at: string | null
}

const EMPTY_SNAPSHOT: InitialSnapshot = {
  materials: [],
  counts: {
    all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0,
    "A1-A2": 0, B1: 0, B2: 0, "C1+": 0,
  },
  storage: { used_bytes: 0, total_bytes: 10 * 1024 * 1024 * 1024 },
  last_uploaded_at: null,
}

async function loadInitialSnapshot(): Promise<InitialSnapshot> {
  try {
    const hdrs = await headers()
    const host = hdrs.get("host")
    const proto = hdrs.get("x-forwarded-proto") ?? "http"
    if (!host) return EMPTY_SNAPSHOT
    const cookie = hdrs.get("cookie") ?? ""
    const res = await fetch(`${proto}://${host}/api/teacher/materials?type=all&level=all&sort=recent`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!res.ok) return EMPTY_SNAPSHOT
    const json = await res.json()
    return {
      materials: Array.isArray(json.materials) ? json.materials : [],
      counts: { ...EMPTY_SNAPSHOT.counts, ...(json.counts ?? {}) },
      storage: {
        used_bytes: Number(json.storage?.used_bytes ?? 0),
        total_bytes: Number(json.storage?.total_bytes ?? 10 * 1024 * 1024 * 1024),
      },
      last_uploaded_at: json.last_uploaded_at ?? null,
    }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export default async function TeacherMaterialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any).from("profiles").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  const snap = await loadInitialSnapshot()
  const totalFiles = Number(snap.counts.all ?? 0)
  const subParts = [
    `${totalFiles} ${pluralFiles(totalFiles)}`,
    `${formatBytes(snap.storage.used_bytes)} из ${formatBytes(snap.storage.total_bytes)}`,
    `последнее добавление ${formatLastAdded(snap.last_uploaded_at)}`,
  ]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-mat">
        <div className="dash-hdr">
          <div>
            <h1>Мои <span className="gl">materials</span></h1>
            <div className="sub">{subParts.join(" · ")}</div>
          </div>
        </div>
        <TeacherMaterialsClient initial={snap} />
      </div>
    </>
  )
}
