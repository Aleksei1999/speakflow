"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"

type Owner = {
  id?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type Material = {
  id: string
  title: string
  description: string | null
  file_type: string | null
  mime_type: string | null
  file_size: number
  level: string | null
  tags: string[] | null
  storage_path: string | null
  file_url?: string | null
  lesson_id: string | null
  is_public: boolean
  created_at: string
  signed_url: string | null
  owner?: Owner | null
}

type Counts = Record<string, number>

type Snapshot = {
  materials: Material[]
  counts: Counts
}

type TypeKey = "pdf" | "ppt" | "doc" | "video" | "audio" | "img" | "link"
type FilterKey = "all" | "new" | "saved" | "unseen"

const STYLES = `
.stu-mat2 *{box-sizing:border-box}
.stu-mat2{font-family:'Inter',-apple-system,sans-serif;font-size:14px;line-height:1.5;color:var(--text)}
.stu-mat2 button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

.stu-mat2 .main-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:14px}
.stu-mat2 .main-header h1{font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.1}
.stu-mat2 .main-header h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-mat2 .main-header .sub{font-size:13px;color:var(--muted);margin-top:4px}

.stu-mat2 .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:100px;font-size:12px;font-weight:700;transition:all .15s;cursor:pointer;border:none}
.stu-mat2 .btn-sm{padding:6px 12px;font-size:11px}
.stu-mat2 .btn-red{background:var(--red);color:#fff}
.stu-mat2 .btn-red:hover{filter:brightness(.9)}
.stu-mat2 .btn-lime{background:var(--lime);color:#0A0A0A}
.stu-mat2 .btn-lime:hover{filter:brightness(.95)}
.stu-mat2 .btn-ghost-dark{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.1)}
.stu-mat2 .btn-ghost-dark:hover{background:rgba(255,255,255,.14)}

/* FROM TEACHER HERO */
.stu-mat2 .from-teacher{
  background:linear-gradient(100deg,#0A0A0A 0%,#1a1a18 60%,#242422 100%);
  border-radius:20px;padding:20px 24px;margin-bottom:20px;color:#fff;
  display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;
  position:relative;overflow:hidden;
}
[data-theme="dark"] .stu-mat2 .from-teacher{background:linear-gradient(100deg,#1a1a18 0%,#222220 100%)}
.stu-mat2 .from-teacher::before{content:'';position:absolute;top:0;bottom:0;left:0;width:4px;background:linear-gradient(180deg,var(--red),var(--lime))}
.stu-mat2 .from-teacher::after{content:'';position:absolute;top:-50%;right:-10%;width:380px;height:380px;background:radial-gradient(circle,rgba(216,242,106,.1),transparent 60%);pointer-events:none}
.stu-mat2 .ft-bignum{font-family:'Gluten',cursive;font-size:64px;font-weight:600;color:var(--lime);line-height:.9;letter-spacing:-2px;position:relative;z-index:1;align-self:center;padding-right:4px}
.stu-mat2 .ft-who{display:flex;align-items:flex-start;gap:12px;position:relative;z-index:1;min-width:0}
.stu-mat2 .ft-avatar{width:42px;height:42px;border-radius:50%;background:var(--red);border:2px solid var(--lime);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;margin-top:2px;color:#fff}
.stu-mat2 .ft-info{min-width:0;flex:1}
.stu-mat2 .ft-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px}
.stu-mat2 .ft-label .pulse{width:6px;height:6px;background:var(--red);border-radius:50%;animation:stuMat2Pulse 1.6s infinite}
@keyframes stuMat2Pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
.stu-mat2 .ft-title{font-size:15px;font-weight:800;letter-spacing:-.2px;line-height:1.3;color:#fff;margin-bottom:6px}
.stu-mat2 .ft-title .gl{font-family:'Gluten',cursive;color:var(--lime);font-weight:600}
.stu-mat2 .ft-sub{font-size:12px;color:rgba(255,255,255,.55);line-height:1.45}
.stu-mat2 .ft-actions{position:relative;z-index:1;display:flex;gap:8px;align-items:center;flex-shrink:0}

/* STATS */
.stu-mat2 .mat-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
.stu-mat2 .m-stat{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px}
.stu-mat2 .m-stat-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.stu-mat2 .m-stat-ico.red{background:rgba(230,57,70,.08);color:var(--red)}
.stu-mat2 .m-stat-ico.lime{background:rgba(216,242,106,.2);color:var(--lime-dark,#5A7A00)}
[data-theme="dark"] .stu-mat2 .m-stat-ico.lime{background:rgba(216,242,106,.15);color:var(--lime)}
.stu-mat2 .m-stat-ico.dark{background:var(--bg);color:var(--text)}
.stu-mat2 .m-stat-ico svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .m-stat-val{font-size:20px;font-weight:800;letter-spacing:-.5px;line-height:1;font-variant-numeric:tabular-nums}
.stu-mat2 .m-stat-val .gl{font-family:'Gluten',cursive;color:var(--red)}
.stu-mat2 .m-stat-lbl{font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}

/* FILTERS */
.stu-mat2 .filters-row{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.stu-mat2 .search-box{flex:1;min-width:220px;position:relative}
.stu-mat2 .search-box svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted);fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .search-input{width:100%;height:40px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px 0 40px;color:var(--text);font-family:inherit;font-size:13px}
.stu-mat2 .search-input:focus{outline:none;border-color:var(--text)}
.stu-mat2 .filter-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:100px;padding:4px;flex-wrap:wrap}
.stu-mat2 .filter-tabs button{padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;color:var(--muted);transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.stu-mat2 .filter-tabs button:hover{color:var(--text)}
.stu-mat2 .filter-tabs button.active{background:var(--accent-dark,#0A0A0A);color:#fff}
[data-theme="dark"] .stu-mat2 .filter-tabs button.active{background:var(--red)}
.stu-mat2 .filter-tabs .count-dot{background:rgba(0,0,0,.08);color:inherit;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800}
[data-theme="dark"] .stu-mat2 .filter-tabs .count-dot{background:rgba(255,255,255,.12)}
.stu-mat2 .filter-tabs button.active .count-dot{background:rgba(255,255,255,.22)}
.stu-mat2 .filter-tabs .new-dot{width:6px;height:6px;background:var(--red);border-radius:50%}

/* SECTION */
.stu-mat2 .section{margin-bottom:28px}
.stu-mat2 .section-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;gap:14px}
.stu-mat2 .section-title{font-size:16px;font-weight:800;letter-spacing:-.3px}
.stu-mat2 .section-title .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.stu-mat2 .section-title .new-pill{display:inline-block;margin-left:8px;padding:2px 8px;background:var(--red);color:#fff;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.3px;vertical-align:middle}
.stu-mat2 .section-sub{font-size:12px;color:var(--muted);font-weight:600}
.stu-mat2 .section-link{font-size:12px;font-weight:700;color:var(--muted);background:none;border:none;cursor:pointer}
.stu-mat2 .section-link:hover{color:var(--text)}

/* LESSON GROUP */
.stu-mat2 .lesson-group{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin-bottom:10px;overflow:hidden;transition:all .15s}
.stu-mat2 .lesson-group:hover{border-color:var(--text)}
.stu-mat2 .lesson-head{display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;user-select:none;width:100%;text-align:left;background:none;border:none;color:inherit}
.stu-mat2 .lesson-head:hover{background:var(--surface-2,var(--bg))}
.stu-mat2 .lesson-date{width:54px;height:54px;background:var(--bg);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.stu-mat2 .lesson-date.today{background:var(--lime);color:#0A0A0A}
.stu-mat2 .lesson-date.upcoming{background:rgba(230,57,70,.08);color:var(--red)}
.stu-mat2 .lesson-date-day{font-size:16px;font-weight:800;line-height:1;letter-spacing:-.5px}
.stu-mat2 .lesson-date-mon{font-size:10px;font-weight:700;text-transform:uppercase;margin-top:2px;opacity:.7}
.stu-mat2 .lesson-info{flex:1;min-width:0}
.stu-mat2 .lesson-title{font-size:14px;font-weight:800;letter-spacing:-.2px;line-height:1.2}
.stu-mat2 .lesson-meta{font-size:11px;color:var(--muted);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.stu-mat2 .lesson-meta .dot{color:var(--muted);opacity:.5}
.stu-mat2 .lesson-count{background:var(--bg);padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
.stu-mat2 .lesson-count.has-new{background:var(--red);color:#fff}
.stu-mat2 .lesson-chevron{color:var(--muted);transition:transform .2s}
.stu-mat2 .lesson-chevron svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .lesson-group.open .lesson-chevron{transform:rotate(180deg)}
.stu-mat2 .lesson-body{border-top:1px solid var(--border);padding:10px 12px;display:none}
.stu-mat2 .lesson-group.open .lesson-body{display:block}

/* MATERIAL ITEM */
.stu-mat2 .mat-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;transition:background .15s;position:relative}
.stu-mat2 .mat-item:hover{background:var(--surface-2,var(--bg))}
.stu-mat2 .mat-item.new::before{content:'';position:absolute;left:-2px;top:14px;width:6px;height:6px;background:var(--red);border-radius:50%;box-shadow:0 0 8px rgba(230,57,70,.4)}
.stu-mat2 .mat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff}
.stu-mat2 .mat-icon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .mat-icon.pdf{background:var(--red)}
.stu-mat2 .mat-icon.ppt{background:#F59E0B}
.stu-mat2 .mat-icon.doc{background:#3B5FE8}
.stu-mat2 .mat-icon.video{background:var(--accent-dark,#0A0A0A)}
[data-theme="dark"] .stu-mat2 .mat-icon.video{background:#666}
.stu-mat2 .mat-icon.audio{background:#8B5CF6}
.stu-mat2 .mat-icon.img{background:var(--lime);color:#0A0A0A}
.stu-mat2 .mat-icon.link{background:#06B6D4}
.stu-mat2 .mat-info{flex:1;min-width:0}
.stu-mat2 .mat-name{font-size:13px;font-weight:700;line-height:1.25;margin-bottom:3px}
.stu-mat2 .mat-name.unread::after{content:'NEW';margin-left:6px;padding:1px 6px;background:var(--red);color:#fff;border-radius:4px;font-size:9px;font-weight:800;letter-spacing:.3px;vertical-align:middle}
.stu-mat2 .mat-meta{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.stu-mat2 .mat-meta .dot{color:var(--muted);opacity:.5}
.stu-mat2 .mat-meta .tag{background:var(--bg);padding:1px 7px;border-radius:100px;font-size:10px;font-weight:600}
.stu-mat2 .mat-xp{font-family:'Gluten',cursive;color:var(--lime-dark,#5A7A00);font-weight:600;font-size:13px;white-space:nowrap;flex-shrink:0}
[data-theme="dark"] .stu-mat2 .mat-xp{color:var(--lime)}
.stu-mat2 .mat-actions{display:flex;gap:4px;flex-shrink:0}
.stu-mat2 .mat-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);transition:all .15s;cursor:pointer}
.stu-mat2 .mat-btn:hover{color:var(--text);border-color:var(--text)}
.stu-mat2 .mat-btn.primary{background:var(--accent-dark,#0A0A0A);border-color:var(--accent-dark,#0A0A0A);color:#fff}
.stu-mat2 .mat-btn.primary:hover{background:var(--red);border-color:var(--red)}
.stu-mat2 .mat-btn svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .mat-btn.star.active{color:var(--lime-dark,#5A7A00);border-color:var(--lime-dark,#5A7A00)}
[data-theme="dark"] .stu-mat2 .mat-btn.star.active{color:var(--lime);border-color:var(--lime)}
.stu-mat2 .mat-btn.star.active svg{fill:currentColor}

/* GRID (PINNED) */
.stu-mat2 .pin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.stu-mat2 .pin-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;display:flex;flex-direction:column;cursor:pointer;transition:all .2s;position:relative;text-align:left;color:inherit}
.stu-mat2 .pin-card:hover{border-color:var(--text);transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow,rgba(10,10,10,.04))}
.stu-mat2 .pin-card-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.stu-mat2 .pin-card-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff}
.stu-mat2 .pin-card-ico svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stu-mat2 .pin-card-ico.pdf{background:var(--red)}
.stu-mat2 .pin-card-ico.ppt{background:#F59E0B}
.stu-mat2 .pin-card-ico.doc{background:#3B5FE8}
.stu-mat2 .pin-card-ico.audio{background:#8B5CF6}
.stu-mat2 .pin-card-ico.video{background:var(--accent-dark,#0A0A0A)}
[data-theme="dark"] .stu-mat2 .pin-card-ico.video{background:#666}
.stu-mat2 .pin-card-ico.img{background:var(--lime);color:#0A0A0A}
.stu-mat2 .pin-card-ico.link{background:#06B6D4}
.stu-mat2 .pin-card-type{font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.stu-mat2 .pin-card-star{margin-left:auto;color:var(--lime-dark,#5A7A00);font-size:14px}
[data-theme="dark"] .stu-mat2 .pin-card-star{color:var(--lime)}
.stu-mat2 .pin-card-name{font-size:13px;font-weight:700;line-height:1.3;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
.stu-mat2 .pin-card-meta{font-size:11px;color:var(--muted);margin-top:auto}
.stu-mat2 .pin-card-meta b{color:var(--text);font-weight:700}

.stu-mat2 .empty-state{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px;background:var(--surface);border:1px dashed var(--border);border-radius:16px}
.stu-mat2 .empty-state b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

@media(max-width:1024px){.stu-mat2 .mat-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){
  .stu-mat2 .from-teacher{grid-template-columns:auto 1fr;gap:14px}
  .stu-mat2 .from-teacher .ft-actions{grid-column:1 / -1;justify-content:flex-start;flex-wrap:wrap;margin-top:4px}
  .stu-mat2 .ft-bignum{font-size:48px}
}
@media(max-width:600px){
  .stu-mat2 .mat-stats{grid-template-columns:1fr 1fr}
  .stu-mat2 .pin-grid{grid-template-columns:1fr 1fr}
  .stu-mat2 .mat-item{flex-wrap:wrap}
  .stu-mat2 .mat-xp{order:3}
}
`

// ------- helpers -------

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000 // 3 days: material considered "new"
const LINK_MIMES = ["text/uri-list"]
const PIN_STORAGE_KEY = "stu_mat_pins_v1"

function mimeToType(mime: string | null | undefined, fileType?: string | null): TypeKey {
  if (fileType && ["pdf", "ppt", "doc", "video", "audio", "img", "link"].includes(fileType)) {
    return fileType as TypeKey
  }
  const m = (mime ?? "").toLowerCase()
  if (!m) return "doc"
  if (m.includes("pdf")) return "pdf"
  if (m.includes("presentation") || m.includes("powerpoint") || m.includes("ppt")) return "ppt"
  if (m.startsWith("video/")) return "video"
  if (m.startsWith("audio/")) return "audio"
  if (m.startsWith("image/")) return "img"
  if (LINK_MIMES.includes(m) || m.includes("url")) return "link"
  return "doc"
}

function isLinkMaterial(m: Material): boolean {
  if (m.storage_path) return false
  if (m.file_url && /^https?:\/\//i.test(m.file_url)) return true
  return mimeToType(m.mime_type, m.file_type) === "link"
}

function formatSize(bytes: number | null | undefined): string {
  const n = Number(bytes || 0)
  if (!Number.isFinite(n) || n <= 0) return ""
  const GB = 1024 * 1024 * 1024
  const MB = 1024 * 1024
  const KB = 1024
  if (n >= GB) return `${(n / GB).toFixed(1)} ГБ`
  if (n >= MB) return `${(n / MB).toFixed(1)} МБ`
  if (n >= KB) return `${(n / KB).toFixed(0)} КБ`
  return `${n} Б`
}

function typeLabel(t: TypeKey): string {
  switch (t) {
    case "pdf": return "PDF"
    case "ppt": return "Презентация"
    case "doc": return "Документ"
    case "video": return "Видео"
    case "audio": return "Аудио"
    case "img": return "Картинка"
    case "link": return "Ссылка"
  }
}

function isNew(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return false
  return Date.now() - d < NEW_WINDOW_MS
}

function xpForMaterial(m: Material): number {
  const t = mimeToType(m.mime_type, m.file_type)
  const base: Record<TypeKey, number> = { pdf: 15, ppt: 15, doc: 10, video: 25, audio: 15, img: 5, link: 10 }
  return base[t] ?? 10
}

function groupKey(m: Material): string {
  if (m.lesson_id) return `lesson:${m.lesson_id}`
  return `date:${(m.created_at || "").slice(0, 10)}`
}

function ownerInitials(name: string | null | undefined): string {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "T"
}

function formatRelativeDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "сегодня"
  if (diffDays === 1) return "вчера"
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) return `${diffDays} дн. назад`
  return format(new Date(iso), "d MMMM", { locale: ru })
}

// ------- icons -------

function TypeIcon({ type }: { type: TypeKey }) {
  switch (type) {
    case "pdf":
      return <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    case "ppt":
      return <svg viewBox="0 0 24 24"><rect width="18" height="14" x="3" y="3" rx="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
    case "doc":
      return <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
    case "video":
      return <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect width="15" height="14" x="1" y="5" rx="2" ry="2"/></svg>
    case "audio":
      return <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    case "img":
      return <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    case "link":
      return <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  }
}

// ------- component -------

export default function StudentMaterialsClient({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState<Snapshot>(initial)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const [apiMissing, setApiMissing] = useState(false)
  const [pins, setPins] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved pins from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PIN_STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setPins(new Set(arr))
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Persist pins
  const togglePin = useCallback((id: string) => {
    setPins((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const reload = useCallback(async () => {
    const params = new URLSearchParams()
    params.set("type", "all")
    params.set("level", "all")
    if (search.trim()) params.set("q", search.trim())
    params.set("sort", "recent")
    try {
      const res = await fetch(`/api/student/materials?${params.toString()}`, { cache: "no-store" })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login"
        return
      }
      if (res.status === 404) {
        setApiMissing(true)
        return
      }
      setApiMissing(false)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setSnap({
        materials: Array.isArray(json.materials) ? json.materials : [],
        counts: {
          all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0,
          "A1-A2": 0, B1: 0, B2: 0, "C1+": 0,
          ...(json.counts ?? {}),
        },
      })
    } catch {
      // keep previous snapshot
    }
  }, [search])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(() => { reload() })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [reload])

  // filter materials (client side) by tab + search
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (snap.materials || []).filter((m) => {
      if (needle) {
        const hay = `${m.title || ""} ${m.description || ""}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (filter === "new" && !isNew(m.created_at)) return false
      if (filter === "saved" && !pins.has(m.id)) return false
      if (filter === "unseen" && !isNew(m.created_at)) return false
      return true
    })
  }, [snap.materials, search, filter, pins])

  // Stats
  const stats = useMemo(() => {
    const all = snap.materials || []
    const newCount = all.filter((m) => isNew(m.created_at)).length
    const studied = Math.max(0, all.length - newCount)
    const xpEarned = all.reduce((acc, m) => acc + (isNew(m.created_at) ? 0 : xpForMaterial(m)), 0)
    return { total: all.length, newCount, studied, xpEarned }
  }, [snap.materials])

  // Group by lesson_id / date
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; lessonId: string | null; items: Material[]; latest: string; hasNew: boolean }>()
    for (const m of filtered) {
      const k = groupKey(m)
      const entry = map.get(k)
      if (entry) {
        entry.items.push(m)
        if (!entry.latest || (m.created_at && m.created_at > entry.latest)) entry.latest = m.created_at
        if (isNew(m.created_at)) entry.hasNew = true
      } else {
        map.set(k, {
          key: k,
          lessonId: m.lesson_id,
          items: [m],
          latest: m.created_at,
          hasNew: isNew(m.created_at),
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.latest || "").localeCompare(a.latest || ""))
  }, [filtered])

  // Auto-open group with fresh materials (only once per snapshot)
  useEffect(() => {
    setOpenGroups((prev) => {
      if (prev.size > 0) return prev
      const next = new Set<string>()
      for (const g of groups) {
        if (g.hasNew) {
          next.add(g.key)
          break
        }
      }
      return next
    })
  }, [groups])

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleDownload = (m: Material) => {
    const url = m.signed_url || m.file_url
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Ссылка на файл недоступна")
    }
  }

  const handlePreview = (m: Material) => {
    // same as download for now: open file in new tab
    handleDownload(m)
  }

  // Pinned materials (top of the page)
  const pinnedMaterials = useMemo(() => {
    return (snap.materials || []).filter((m) => pins.has(m.id))
  }, [snap.materials, pins])

  // Latest lesson hero (most recent lesson with fresh materials)
  const hero = useMemo(() => {
    const freshGroups = groups.filter((g) => g.hasNew && g.lessonId)
    if (freshGroups.length === 0) return null
    const g = freshGroups[0]
    const first = g.items[0]
    const teacherName = first?.owner?.full_name || null
    return {
      count: g.items.length,
      teacherName,
      title: first?.title || "Свежие материалы",
      description: first?.description || "Изучи, что добавил преподаватель после урока",
      groupKey: g.key,
    }
  }, [groups])

  const counts = {
    all: (snap.materials || []).length,
    new: (snap.materials || []).filter((m) => isNew(m.created_at)).length,
    saved: pins.size,
    unseen: (snap.materials || []).filter((m) => isNew(m.created_at)).length,
  }

  return (
    <div className="stu-mat2">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="main-header">
        <div>
          <h1>Мои <span className="gl">materials</span></h1>
          <div className="sub">Всё, что твои преподаватели добавляют после уроков: шаблоны, видео, упражнения для закрепления</div>
        </div>
      </div>

      {/* FROM TEACHER HERO */}
      {hero ? (
        <div className="from-teacher">
          <div className="ft-bignum">{hero.count}</div>
          <div className="ft-who">
            <div className="ft-avatar">{ownerInitials(hero.teacherName)}</div>
            <div className="ft-info">
              <div className="ft-label">
                <span className="pulse" />
                после урока{hero.teacherName ? ` · добавил(а) ${hero.teacherName}` : ""}
              </div>
              <div className="ft-title">
                Закрепи тему <span className="gl">{hero.title}</span>
              </div>
              <div className="ft-sub">{hero.description}</div>
            </div>
          </div>
          <div className="ft-actions">
            <button
              className="btn btn-lime"
              onClick={() => {
                setFilter("new")
                setOpenGroups(new Set([hero.groupKey]))
              }}
            >
              Открыть всё
            </button>
            <button className="btn btn-ghost-dark" onClick={() => setFilter("all")}>Позже</button>
          </div>
        </div>
      ) : null}

      {/* STATS */}
      <div className="mat-stats">
        <div className="m-stat">
          <div className="m-stat-ico red">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div className="m-stat-val">{stats.total}</div>
            <div className="m-stat-lbl">Всего материалов</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico red">
            <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          </div>
          <div>
            <div className="m-stat-val" style={{ color: "var(--red)" }}>{stats.newCount}</div>
            <div className="m-stat-lbl">Новых, посмотреть</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico lime">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div className="m-stat-val">{stats.studied}</div>
            <div className="m-stat-lbl">Уже изучил(а)</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico dark">
            <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div className="m-stat-val"><span className="gl">+{stats.xpEarned}</span> XP</div>
            <div className="m-stat-lbl">Получил(а) за изучение</div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters-row">
        <div className="search-box">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            className="search-input"
            placeholder="Найти материал..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs" role="tablist">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Все <span className="count-dot">{counts.all}</span>
          </button>
          <button
            className={filter === "new" ? "active" : ""}
            onClick={() => setFilter("new")}
          >
            <span className="new-dot" />Новые <span className="count-dot">{counts.new}</span>
          </button>
          <button
            className={filter === "saved" ? "active" : ""}
            onClick={() => setFilter("saved")}
          >
            ⭐ Сохранённые <span className="count-dot">{counts.saved}</span>
          </button>
          <button
            className={filter === "unseen" ? "active" : ""}
            onClick={() => setFilter("unseen")}
          >
            Не посмотрел(а) <span className="count-dot">{counts.unseen}</span>
          </button>
        </div>
      </div>

      {apiMissing ? (
        <div className="empty-state">
          <b>API подготавливается</b>
          Эндпоинт /api/student/materials ещё не задеплоен — обнови страницу через минуту.
        </div>
      ) : null}

      {/* PINNED / FAVORITES */}
      {pinnedMaterials.length > 0 ? (
        <div className="section">
          <div className="section-head">
            <div>
              <div className="section-title">⭐ Сохранил(а) для себя</div>
              <div className="section-sub" style={{ marginTop: 4 }}>Материалы, к которым возвращаешься чаще всего</div>
            </div>
          </div>
          <div className="pin-grid">
            {pinnedMaterials.slice(0, 8).map((m) => {
              const t = mimeToType(m.mime_type, m.file_type)
              return (
                <button
                  key={m.id}
                  className="pin-card"
                  onClick={() => handlePreview(m)}
                  type="button"
                >
                  <div className="pin-card-top">
                    <div className={`pin-card-ico ${t}`}><TypeIcon type={t} /></div>
                    <div className="pin-card-type">{typeLabel(t)}</div>
                    <div className="pin-card-star">★</div>
                  </div>
                  <div className="pin-card-name">{m.title}</div>
                  <div className="pin-card-meta">
                    {formatSize(m.file_size) ? <><b>{formatSize(m.file_size)}</b>{" · "}</> : null}
                    {formatRelativeDay(m.created_at)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* BY LESSON */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">
              После <span className="gl">lesson</span>
              {counts.new > 0 ? <span className="new-pill">{counts.new} НОВ.</span> : null}
            </div>
            <div className="section-sub" style={{ marginTop: 4 }}>
              Материалы от преподавателей сгруппированы по занятиям
            </div>
          </div>
        </div>

        {groups.length === 0 && !apiMissing ? (
          <div className="empty-state">
            <b>Пока нет материалов</b>
            Твои преподаватели ещё не поделились материалами. Они появятся здесь, как только учитель их пришлёт.
          </div>
        ) : null}

        {groups.map((g) => {
          const open = openGroups.has(g.key)
          const first = g.items[0]
          const teacherName = first?.owner?.full_name || "Преподаватель"
          const dateObj = first?.created_at ? new Date(first.created_at) : new Date()
          const day = format(dateObj, "dd", { locale: ru })
          const mon = format(dateObj, "LLL", { locale: ru }).replace(".", "")
          const relDay = formatRelativeDay(first?.created_at || new Date().toISOString())
          const level = first?.level || null
          return (
            <div key={g.key} className={`lesson-group${open ? " open" : ""}`}>
              <button
                className="lesson-head"
                onClick={() => toggleGroup(g.key)}
                type="button"
              >
                <div className={`lesson-date${g.hasNew ? " today" : ""}`}>
                  <div className="lesson-date-day">{day}</div>
                  <div className="lesson-date-mon">{mon}</div>
                </div>
                <div className="lesson-info">
                  <div className="lesson-title">
                    {g.lessonId ? `Урок от ${format(dateObj, "d MMMM", { locale: ru })}` : "Публичные и прочие материалы"}
                  </div>
                  <div className="lesson-meta">
                    <span>{relDay}</span>
                    <span className="dot">•</span>
                    <span>{teacherName}</span>
                    {level ? (
                      <>
                        <span className="dot">•</span>
                        <span>{level}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className={`lesson-count${g.hasNew ? " has-new" : ""}`}>
                  {g.hasNew ? `+${g.items.filter((m) => isNew(m.created_at)).length} новых` : `${g.items.length} материалов`}
                </div>
                <span className="lesson-chevron">
                  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </button>
              {open ? (
                <div className="lesson-body">
                  {g.items.map((m) => (
                    <MaterialRow
                      key={m.id}
                      m={m}
                      pinned={pins.has(m.id)}
                      onToggleStar={() => togglePin(m.id)}
                      onPreview={() => handlePreview(m)}
                      onDownload={() => handleDownload(m)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MaterialRow({
  m,
  pinned,
  onToggleStar,
  onPreview,
  onDownload,
}: {
  m: Material
  pinned: boolean
  onToggleStar: () => void
  onPreview: () => void
  onDownload: () => void
}) {
  const t = mimeToType(m.mime_type, m.file_type)
  const isLink = isLinkMaterial(m)
  const fresh = isNew(m.created_at)
  const size = formatSize(m.file_size)
  const xp = xpForMaterial(m)
  const tags = (m.tags || []).slice(0, 2)

  return (
    <div className={`mat-item${fresh ? " new" : ""}`}>
      <div className={`mat-icon ${t}`}><TypeIcon type={t} /></div>
      <div className="mat-info">
        <div className={`mat-name${fresh ? " unread" : ""}`}>{m.title}</div>
        <div className="mat-meta">
          <span>
            {typeLabel(t)}
            {size ? ` · ${size}` : ""}
          </span>
          {m.description ? (
            <>
              <span className="dot">•</span>
              <span>{m.description}</span>
            </>
          ) : null}
          {tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className="mat-xp">{fresh ? `+${xp} XP` : `+${xp} XP ✓`}</div>
      <div className="mat-actions">
        <button
          className={`mat-btn star${pinned ? " active" : ""}`}
          title={pinned ? "Убрать из сохранённых" : "Сохранить себе"}
          onClick={(e) => { e.stopPropagation(); onToggleStar() }}
          type="button"
        >
          <svg viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button
          className="mat-btn primary"
          title={isLink ? "Открыть" : "Посмотреть"}
          onClick={(e) => { e.stopPropagation(); onPreview() }}
          type="button"
        >
          {isLink ? (
            <svg viewBox="0 0 24 24"><path d="M7 17 L17 7 M7 7 h10 v10"/></svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
        {!isLink ? (
          <button
            className="mat-btn"
            title="Скачать"
            onClick={(e) => { e.stopPropagation(); onDownload() }}
            type="button"
          >
            <svg viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
