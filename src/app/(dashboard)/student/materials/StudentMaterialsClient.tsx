// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"

type Owner = {
  id?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type ShareInfo = {
  source: "public" | "lesson" | "student" | "group" | "homework" | string
  group_name?: string | null
  homework_title?: string | null
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
  lesson_id: string | null
  is_public: boolean
  created_at: string
  signed_url: string | null
  owner?: Owner | null
  share?: ShareInfo | null
}

type Counts = Record<string, number>

type Snapshot = {
  materials: Material[]
  counts: Counts
}

type TypeKey = "all" | "pdf" | "ppt" | "doc" | "video" | "audio" | "img" | "link"
type LevelKey = "all" | "A1-A2" | "B1" | "B2" | "C1+"
type SortKey = "recent" | "name" | "size"

const TYPE_LABELS: Record<Exclude<TypeKey, "all">, string> = {
  pdf: "PDF",
  ppt: "Презентации",
  doc: "Документы",
  video: "Видео",
  audio: "Аудио",
  img: "Картинки",
  link: "Ссылки",
}

const BADGE_BY_TYPE: Record<string, string> = {
  pdf: "PDF",
  ppt: "PPT",
  doc: "DOCX",
  video: "MP4",
  audio: "MP3",
  img: "PNG",
  link: "Link",
}

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
  if (m === "text/uri-list" || m.includes("url")) return "link"
  return "doc"
}

function badgeForMaterial(m: Material): string {
  const t = mimeToType(m.mime_type, m.file_type)
  const mime = (m.mime_type ?? "").toLowerCase()
  if (t === "doc" && mime.includes("wordprocessingml")) return "DOCX"
  if (t === "img" && mime.includes("jpeg")) return "JPG"
  if (t === "img" && mime.includes("webp")) return "WEBP"
  if (t === "audio" && mime.includes("wav")) return "WAV"
  if (t === "video" && mime.includes("webm")) return "WEBM"
  return BADGE_BY_TYPE[t] ?? "FILE"
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б"
  const GB = 1024 * 1024 * 1024
  const MB = 1024 * 1024
  const KB = 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} ГБ`
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} МБ`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} КБ`
  return `${bytes} Б`
}

function formatRelative(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "сегодня"
  if (diffDays === 1) return "вчера"
  if (diffDays < 30) {
    return formatDistanceToNow(d, { addSuffix: false, locale: ru }) + " назад"
  }
  return format(d, "LLLL yyyy", { locale: ru })
}

function initialsOf(name: string | null | undefined): string {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function sourceLabel(share: ShareInfo | null | undefined): { label: string; cls: string } | null {
  if (!share || !share.source) return null
  switch (share.source) {
    case "public":
      return { label: "Публичный", cls: "public" }
    case "lesson":
      return { label: "Через урок", cls: "lesson" }
    case "student":
      return { label: "Для меня", cls: "student" }
    case "group":
      return { label: share.group_name ? `Группа: ${share.group_name}` : "Группа", cls: "group" }
    case "homework":
      return { label: share.homework_title ? `Домашка: ${share.homework_title}` : "Домашка", cls: "homework" }
    default:
      return null
  }
}

function TypeIcon({ type }: { type: TypeKey }) {
  switch (type) {
    case "pdf":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    case "ppt":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="3" rx="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
    case "doc":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
    case "video":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect width="15" height="14" x="1" y="5" rx="2" ry="2"/></svg>
    case "audio":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    case "img":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    case "link":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  }
}

const TYPE_ORDER: Array<TypeKey> = ["all", "pdf", "ppt", "doc", "video", "audio", "img", "link"]
const LEVEL_ORDER: Array<LevelKey> = ["A1-A2", "B1", "B2", "C1+"]

export default function StudentMaterialsClient({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState<Snapshot>(initial)
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all")
  const [levelFilter, setLevelFilter] = useState<LevelKey>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isPending, startTransition] = useTransition()
  const [apiMissing, setApiMissing] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async () => {
    const params = new URLSearchParams()
    params.set("type", typeFilter)
    params.set("level", levelFilter)
    if (search.trim()) params.set("q", search.trim())
    params.set("sort", sort)
    try {
      const res = await fetch(`/api/student/materials?${params.toString()}`, {
        cache: "no-store",
      })
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
      // keep previous
    }
  }, [typeFilter, levelFilter, search, sort])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(() => { reload() })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [reload])

  async function handleDownload(m: Material) {
    if (m.signed_url) {
      window.open(m.signed_url, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Ссылка на файл недоступна")
    }
  }

  const counts = snap.counts

  return (
    <div className="materials-grid">
      <aside className="cat-side">
        <div className="cat-title">Типы файлов</div>
        <div className="cat-list">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              className={`cat-item${typeFilter === t ? " active" : ""}`}
              onClick={() => setTypeFilter(t)}
            >
              <span className="cat-icon" aria-hidden>
                <TypeIcon type={t} />
              </span>
              {t === "all" ? "Все" : TYPE_LABELS[t]}
              <span className="cat-count">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="cat-title" style={{ marginTop: 16 }}>Уровни</div>
        <div className="cat-list">
          <button
            className={`cat-item${levelFilter === "all" ? " active" : ""}`}
            onClick={() => setLevelFilter("all")}
          >
            Все уровни
            <span className="cat-count">{counts.all ?? 0}</span>
          </button>
          {LEVEL_ORDER.map((lvl) => (
            <button
              key={lvl}
              className={`cat-item${levelFilter === lvl ? " active" : ""}`}
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl}
              <span className="cat-count">{counts[lvl] ?? 0}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="content-area">
        <div className="toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск материалов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="recent">Недавно добавленные</option>
            <option value="name">По названию</option>
            <option value="size">По размеру</option>
          </select>
          <div className="view-toggle">
            <button
              className={`view-btn${viewMode === "grid" ? " active" : ""}`}
              onClick={() => setViewMode("grid")}
              aria-label="Сетка"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button
              className={`view-btn${viewMode === "list" ? " active" : ""}`}
              onClick={() => setViewMode("list")}
              aria-label="Список"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>

        {apiMissing ? (
          <div className="empty-state">
            <b>API подготавливается</b>
            Эндпоинт /api/student/materials ещё не задеплоен — обнови страницу через минуту.
          </div>
        ) : snap.materials.length === 0 ? (
          <div className="empty-state">
            <b>Пока нет материалов</b>
            Твои учителя ещё не поделились материалами. Они появятся здесь, как только учитель их пришлёт.
          </div>
        ) : (
          <div className={viewMode === "grid" ? "mat-grid" : "mat-list"}>
            {snap.materials.map((m) => (
              <MatCard key={m.id} m={m} onDownload={handleDownload} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MatCard({ m, onDownload }: { m: Material; onDownload: (m: Material) => void }) {
  const type = mimeToType(m.mime_type, m.file_type)
  const badge = badgeForMaterial(m)
  const sizeLabel = type === "link" ? hostnameOf(m.signed_url ?? m.storage_path ?? "") : formatSize(m.file_size)
  const dateLabel = formatRelative(m.created_at)
  const src = sourceLabel(m.share)
  const ownerName = m.owner?.full_name ?? "Преподаватель"
  return (
    <div className="mat-card">
      <div className="mat-thumb">
        <div className={`mat-thumb-icon ${type}`}>
          <TypeIcon type={type} />
        </div>
        <span className="mat-type-badge">{badge}</span>
        {src ? <span className={`source-badge ${src.cls}`} title={src.label}>{src.label}</span> : null}
      </div>
      <div className="mat-body">
        <div className="mat-title" title={m.title}>{m.title}</div>
        <div className="mat-meta">
          <b>{sizeLabel}</b>{dateLabel ? ` · ${dateLabel}` : ""}
        </div>
        <div className="mat-tags">
          {m.level ? <span className="mat-tag level">{m.level}</span> : null}
          {(m.tags ?? []).slice(0, 2).map((t) => (
            <span key={t} className="mat-tag">{t}</span>
          ))}
        </div>
        <div className="mat-footer">
          <span className="mat-owner" title={ownerName}>
            {m.owner?.avatar_url ? (
              <img className="ow-av" src={m.owner.avatar_url} alt={ownerName} />
            ) : (
              <span className="ow-av">{initialsOf(ownerName) || "?"}</span>
            )}
            <span className="ow-nm">{ownerName}</span>
          </span>
          <div className="mat-actions">
            <button
              className="mat-btn primary"
              title={type === "link" ? "Открыть" : "Скачать"}
              onClick={(e) => { e.stopPropagation(); onDownload(m) }}
            >
              {type === "link" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 L17 7 M7 7 h10 v10"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "—"
  }
}
