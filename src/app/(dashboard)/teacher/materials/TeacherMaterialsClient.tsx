// @ts-nocheck
"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ru, enUS } from "date-fns/locale"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// ShareMaterialModal (~650 строк) открывается по клику «Поделиться» —
// для первого рендера /teacher/materials не нужен.
const ShareMaterialModal = dynamic(() => import("./ShareMaterialModal"), {
  ssr: false,
  loading: () => null,
})
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"

const MATERIALS_BUCKET = "teacher-materials"
const MAX_MATERIAL_SIZE = 50 * 1024 * 1024 // 50 MB

function safeFileName(name: string): string {
  const base = (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file.bin"
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
  use_count: number
  storage_path: string | null
  lesson_id: string | null
  is_public: boolean
  created_at: string
  signed_url: string | null
}

type Counts = Record<string, number>

type Snapshot = {
  materials: Material[]
  counts: Counts
  storage: { used_bytes: number; total_bytes: number }
  last_uploaded_at: string | null
}

type TypeKey = "all" | "pdf" | "ppt" | "doc" | "video" | "audio" | "img" | "link"
type LevelKey = "all" | "A1-A2" | "B1" | "B2" | "C1+"
type SortKey = "recent" | "popular" | "name" | "size"

// NOTE: dead — kept for callsite compatibility, type labels now come from typeLabel()/t().
// Localized via t("typePdf") etc. inside the component.

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

function formatSize(bytes: number, u: { b: string; kb: string; mb: string; gb: string } = { b: "B", kb: "KB", mb: "MB", gb: "GB" }): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 ${u.b}`
  const GB = 1024 * 1024 * 1024
  const MB = 1024 * 1024
  const KB = 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} ${u.gb}`
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} ${u.mb}`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} ${u.kb}`
  return `${bytes} ${u.b}`
}

// NOTE: dead — shadowed by locale-aware formatRelative inside the component.

// --- SVG icon helpers ---
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

export default function TeacherMaterialsClient({ initial }: { initial: Snapshot }) {
  const t = useTranslations("dashboard.teacher.materials")
  const locale = useLocale()
  const dateLocale = locale === "ru" ? ru : enUS
  const typeLabel = (k: Exclude<TypeKey, "all">): string => {
    switch (k) {
      case "pdf": return t("typePdf")
      case "ppt": return t("typePpt")
      case "doc": return t("typeDoc")
      case "video": return t("typeVideo")
      case "audio": return t("typeAudio")
      case "img": return t("typeImg")
      case "link": return t("typeLink")
    }
  }
  const formatRelative = (iso: string | null): string => {
    if (!iso) return ""
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return t("today")
    if (diffDays === 1) return t("yesterday")
    if (diffDays < 30) {
      return formatDistanceToNow(d, { addSuffix: false, locale: dateLocale }) + ` ${t("units.ago")}`
    }
    return format(d, "LLLL yyyy", { locale: dateLocale })
  }
  const [snap, setSnap] = useState<Snapshot>(initial)
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all")
  const [levelFilter, setLevelFilter] = useState<LevelKey>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [apiMissing, setApiMissing] = useState(false)

  // Share modal state
  const [shareOpen, setShareOpen] = useState(false)
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null)

  // Upload modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uTitle, setUTitle] = useState("")
  const [uDesc, setUDesc] = useState("")
  const [uLevel, setULevel] = useState<LevelKey>("B1")
  const [uTags, setUTags] = useState("")
  const [uPublic, setUPublic] = useState(false)
  const [uLessonId, setULessonId] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  // Drag-drop state
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debounced fetch
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const params = new URLSearchParams()
    params.set("type", typeFilter)
    params.set("level", levelFilter)
    if (search.trim()) params.set("q", search.trim())
    params.set("sort", sort)

    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/teacher/materials?${params.toString()}`, {
        cache: "no-store",
      })
      if (res.status === 404) {
        setApiMissing(true)
        return
      }
      setApiMissing(false)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setSnap({
        materials: Array.isArray(json.materials) ? json.materials : [],
        counts: { all: 0, pdf: 0, ppt: 0, doc: 0, video: 0, audio: 0, img: 0, link: 0, "A1-A2": 0, B1: 0, B2: 0, "C1+": 0, ...(json.counts ?? {}) },
        storage: {
          used_bytes: Number(json.storage?.used_bytes ?? 0),
          total_bytes: Number(json.storage?.total_bytes ?? 10 * 1024 * 1024 * 1024),
        },
        last_uploaded_at: json.last_uploaded_at ?? null,
      })
    } catch {
      // keep previous snapshot; likely API not ready
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [typeFilter, levelFilter, search, sort])

  // Debounced reload on search/sort change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(() => { reload() })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [reload])

  // Body-level drag listeners to highlight drop zone
  useEffect(() => {
    let counter = 0
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types?.includes("Files")) return
      counter++
      setIsDragging(true)
    }
    function onDragLeave() {
      counter--
      if (counter <= 0) {
        counter = 0
        setIsDragging(false)
      }
    }
    function onDragOver(e: DragEvent) {
      if (!e.dataTransfer?.types?.includes("Files")) return
      e.preventDefault()
    }
    function onDrop(e: DragEvent) {
      counter = 0
      setIsDragging(false)
    }
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  function handleDropFile(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) openUploadModal(file)
  }

  function openUploadModal(file: File | null) {
    setPendingFile(file)
    setUTitle(file ? file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ") : "")
    setUDesc("")
    setULevel("B1")
    setUTags("")
    setUPublic(false)
    setULessonId("")
    setModalOpen(true)
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) openUploadModal(file)
    if (e.target) e.target.value = ""
  }

  async function submitUpload() {
    if (!pendingFile || !uTitle.trim()) {
      toast.error(t("errorPickFile"))
      return
    }
    if (pendingFile.size > MAX_MATERIAL_SIZE) {
      toast.error(t("errorTooBig"))
      return
    }
    setIsUploading(true)
    let uploadedPath: string | null = null
    const supabase = createSupabaseBrowserClient()
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()
      if (userErr || !user) {
        toast.error(t("errorAuth"))
        return
      }

      const mime = pendingFile.type || "application/octet-stream"
      const safe = safeFileName(pendingFile.name)
      const storagePath = `${user.id}/${Date.now()}_${safe}`

      // 1) Direct client → Supabase Storage (bypass Vercel 4.5 MB body limit).
      const { error: upErr } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .upload(storagePath, pendingFile, {
          contentType: mime,
          cacheControl: "3600",
          upsert: false,
        })
      if (upErr) {
        console.error("storage.upload error:", upErr)
        toast.error(upErr.message || t("errorUpload"))
        return
      }
      uploadedPath = storagePath

      // 2) Metadata → our API (small JSON body, safe for Vercel).
      const tagsArr = uTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const payload = {
        title: uTitle.trim(),
        description: uDesc.trim() || null,
        level: uLevel && uLevel !== "all" ? uLevel : null,
        tags: tagsArr,
        is_public: uPublic,
        lesson_id: uLessonId.trim() || null,
        storage_path: storagePath,
        file_name: pendingFile.name,
        file_size: pendingFile.size,
        mime_type: mime,
      }

      const res = await fetch("/api/teacher/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.status === 404) {
        toast.error(t("modal.errorApiUnavailable"))
        setApiMissing(true)
        return
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        toast.error(`${t("modal.errorSavePrefix")}${text ? `: ${text.slice(0, 120)}` : ""}`)
        return
      }
      uploadedPath = null // metadata saved — don't rollback storage
      toast.success(t("successUploaded"))
      setModalOpen(false)
      setPendingFile(null)
      reload()
    } catch (err: any) {
      toast.error(err?.message ?? t("errorGeneric"))
    } finally {
      // If metadata insert failed, remove the orphan blob.
      if (uploadedPath) {
        try {
          await supabase.storage.from(MATERIALS_BUCKET).remove([uploadedPath])
        } catch {
          /* best-effort */
        }
      }
      setIsUploading(false)
    }
  }

  async function handleDelete(m: Material) {
    const ok = typeof window !== "undefined" ? window.confirm(t("modal.confirmDelete", { title: m.title })) : false
    if (!ok) return
    // optimistic
    setSnap((prev) => ({ ...prev, materials: prev.materials.filter((x) => x.id !== m.id) }))
    try {
      const res = await fetch(`/api/teacher/materials/${encodeURIComponent(m.id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("HTTP " + res.status)
      toast.success(t("successDeleted"))
      reload({ silent: true })
    } catch {
      toast.error(t("errorDelete"))
      reload()
    }
  }

  async function trackUse(id: string) {
    try {
      await fetch(`/api/teacher/materials/${encodeURIComponent(id)}/track-use`, { method: "POST" })
    } catch {}
  }

  async function handleDownload(m: Material) {
    await trackUse(m.id)
    if (m.signed_url) {
      window.open(m.signed_url, "_blank", "noopener,noreferrer")
    } else {
      toast.error(t("errorLinkUnavailable"))
    }
    // optimistic bump
    setSnap((prev) => ({
      ...prev,
      materials: prev.materials.map((x) => (x.id === m.id ? { ...x, use_count: x.use_count + 1 } : x)),
    }))
  }

  function handleAttach(m: Material) {
    setShareTarget({ id: m.id, title: m.title })
    setShareOpen(true)
  }

  // Derived: "recent" default view splits into Recent + Popular
  const splitSections = useMemo(() => {
    return (
      sort === "recent" &&
      typeFilter === "all" &&
      levelFilter === "all" &&
      !search.trim() &&
      snap.materials.length > 4
    )
  }, [sort, typeFilter, levelFilter, search, snap.materials.length])

  const recentItems = useMemo(() => (splitSections ? snap.materials.slice(0, 4) : []), [splitSections, snap.materials])
  const popularItems = useMemo(() => {
    if (!splitSections) return []
    return [...snap.materials.slice(4)].sort((a, b) => b.use_count - a.use_count)
  }, [splitSections, snap.materials])

  const counts = snap.counts

  return (
    <>
      <div className="materials-grid">
        {/* CATEGORIES SIDEBAR */}
        <aside className="cat-side">
          <div className="cat-title">{t("categoryTypes")}</div>
          <div className="cat-list">
            {TYPE_ORDER.map((tk) => (
              <button
                key={tk}
                className={`cat-item${typeFilter === tk ? " active" : ""}`}
                onClick={() => setTypeFilter(tk)}
              >
                <span className="cat-icon" aria-hidden>
                  <TypeIcon type={tk} />
                </span>
                {tk === "all" ? t("filterAll") : typeLabel(tk)}
                <span className="cat-count">{counts[tk] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="cat-title" style={{ marginTop: 16 }}>{t("categoryLevels")}</div>
          <div className="cat-list">
            <button
              className={`cat-item${levelFilter === "all" ? " active" : ""}`}
              onClick={() => setLevelFilter("all")}
            >
              {t("filterAll")}
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

          <div
            className={`upload-zone${isDragging ? " dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault() }}
            onDrop={handleDropFile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <div className="up-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <div className="up-text">{t("uploadCta")}</div>
            <div className="up-sub">{t("uploadHint")}</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFilePick}
          />
        </aside>

        {/* CONTENT AREA */}
        <div className="content-area">
          <div className="toolbar">
            <input
              type="text"
              className="search-input"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="recent">{t("sortRecent")}</option>
              <option value="popular">{t("sortPopular")}</option>
              <option value="name">{t("sortName")}</option>
              <option value="size">{t("sortSize")}</option>
            </select>
            <div className="view-toggle">
              <button
                className={`view-btn${viewMode === "grid" ? " active" : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label={t("viewGridAria")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
              <button
                className={`view-btn${viewMode === "list" ? " active" : ""}`}
                onClick={() => setViewMode("list")}
                aria-label={t("viewListAria")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <button className="btn btn-primary" onClick={() => openUploadModal(null)}>+ {t("uploadCta")}</button>
          </div>

          {apiMissing ? (
            <div className="empty-state">
              <b>{t("emptyTitle")}</b>
              {t("emptyHint")}
            </div>
          ) : snap.materials.length === 0 ? (
            <div className="empty-state">
              <b>{t("emptyTitle")}</b>
              {t("emptyHint")}
            </div>
          ) : splitSections ? (
            <>
              <div className="section-heading">{t("sectionRecent")} <span className="line" /></div>
              <MaterialsContainer
                viewMode={viewMode}
                items={recentItems}
                t={t}
                formatRelative={formatRelative}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onAttach={handleAttach}
              />
              <div className="section-heading">{t("sectionPopular")} <span className="line" /></div>
              <MaterialsContainer
                viewMode={viewMode}
                items={popularItems}
                t={t}
                formatRelative={formatRelative}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onAttach={handleAttach}
              />
            </>
          ) : (
            <MaterialsContainer
              viewMode={viewMode}
              items={snap.materials}
              t={t}
              formatRelative={formatRelative}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onAttach={handleAttach}
            />
          )}
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>{t("modalUploadTitle")}</h2>
            <div className="modal-sub">{t("modalUploadSub")}</div>

            {pendingFile ? (
              <div className="file-pill">
                <div className="fp-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="fp-name">{pendingFile.name}</div>
                <div className="fp-size">{formatSize(pendingFile.size, { b: t("units.b"), kb: t("units.kb"), mb: t("units.mb"), gb: t("units.gb") })}</div>
              </div>
            ) : (
              <div
                className="upload-zone"
                style={{ marginTop: 0, marginBottom: 16 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="up-text">{t("modalPickFile")}</div>
                <div className="up-sub">{t("modalPickFileHint")}</div>
              </div>
            )}

            <div className="field">
              <label>{t("fieldTitle")}</label>
              <input value={uTitle} onChange={(e) => setUTitle(e.target.value)} placeholder={t("fieldTitlePlaceholder")} />
            </div>

            <div className="field">
              <label>{t("fieldDesc")}</label>
              <textarea value={uDesc} onChange={(e) => setUDesc(e.target.value)} placeholder={t("fieldDescPlaceholder")} />
            </div>

            <div className="field">
              <label>{t("fieldLevel")}</label>
              <select value={uLevel} onChange={(e) => setULevel(e.target.value as LevelKey)}>
                <option value="A1-A2">A1-A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1+">C1+</option>
              </select>
            </div>

            <div className="field">
              <label>{t("fieldTags")}</label>
              <input value={uTags} onChange={(e) => setUTags(e.target.value)} placeholder="Grammar, IELTS, Vocabulary" />
            </div>

            <div className="field">
              <label>{t("fieldLessonId")}</label>
              <input value={uLessonId} onChange={(e) => setULessonId(e.target.value)} placeholder={t("fieldLessonIdPlaceholder")} />
            </div>

            <div className="toggle-row">
              <button
                type="button"
                className={`toggle-sw${uPublic ? " on" : ""}`}
                onClick={() => setUPublic(!uPublic)}
                aria-label={t("togglePublicAria")}
              />
              <span className="toggle-lbl">{t("togglePublicLabel")}</span>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isUploading}>
                {t("cancelCta")}
              </button>
              <button className="btn btn-primary" onClick={submitUpload} disabled={isUploading || !pendingFile || !uTitle.trim()}>
                {isUploading ? t("uploadingCta") : t("uploadCtaConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {shareTarget && (
        <ShareMaterialModal
          materialId={shareTarget.id}
          materialTitle={shareTarget.title}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  )
}

function MaterialsContainer({
  viewMode,
  items,
  t,
  formatRelative,
  onDelete,
  onDownload,
  onAttach,
}: any) {
  if (items.length === 0) {
    return <div className="empty-state" style={{ padding: "30px 22px" }}><b>{t("noMatchTitle")}</b>{t("noMatchHint")}</div>
  }
  return (
    <div className={viewMode === "grid" ? "mat-grid" : "mat-list"}>
      {items.map((m: Material) => (
        <MatCard key={m.id} m={m} t={t} formatRelative={formatRelative} onDelete={onDelete} onDownload={onDownload} onAttach={onAttach} />
      ))}
    </div>
  )
}

function MatCard({
  m,
  t,
  formatRelative,
  onDelete,
  onDownload,
  onAttach,
}: any) {
  const type = mimeToType(m.mime_type, m.file_type)
  const badge = badgeForMaterial(m)
  const sizeLabel = type === "link" ? hostnameOf(m.signed_url ?? m.storage_path ?? "") : formatSize(m.file_size)
  const dateLabel = formatRelative(m.created_at)
  return (
    <div className="mat-card">
      <div className="mat-thumb">
        <div className={`mat-thumb-icon ${type}`}>
          <TypeIcon type={type} />
        </div>
        <span className="mat-type-badge">{badge}</span>
      </div>
      <div className="mat-body">
        <div className="mat-title" title={m.title}>{m.title}</div>
        <div className="mat-meta">
          <b>{sizeLabel}</b>{dateLabel ? ` · ${dateLabel}` : ""}
        </div>
        <div className="mat-tags">
          {m.level ? <span className="mat-tag level">{m.level}</span> : null}
          {(m.tags ?? []).slice(0, 2).map((tag: string) => (
            <span key={tag} className="mat-tag">{tag}</span>
          ))}
        </div>
        <div className="mat-footer">
          <span className="mat-use-count">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6 L5 9 L10 3" /></svg>
            {m.use_count ?? 0}×
          </span>
          <div className="mat-actions">
            <button className="mat-btn primary" title={t("actionAttachTitle")} onClick={(e: any) => { e.stopPropagation(); onAttach(m) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button className="mat-btn" title={type === "link" ? t("actionOpenTitle") : t("actionDownloadTitle")} onClick={(e: any) => { e.stopPropagation(); onDownload(m) }}>
              {type === "link" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 L17 7 M7 7 h10 v10"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              )}
            </button>
            <button className="mat-btn danger" title={t("actionDeleteTitle")} onClick={(e: any) => { e.stopPropagation(); onDelete(m) }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
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
