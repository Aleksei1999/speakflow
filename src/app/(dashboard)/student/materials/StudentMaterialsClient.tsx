"use client"

import "@/styles/dashboard/student-materials.css"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("dashboard.student.materials")
  const [snap, setSnap] = useState<Snapshot>(initial)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()
  const [apiMissing, setApiMissing] = useState(false)
  const [pins, setPins] = useState<Set<string>>(new Set())
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState<boolean>(
    Array.isArray(initial.materials) && initial.materials.length > 0
  )

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
    } finally {
      setLoaded(true)
    }
  }, [search])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Очистка поля поиска должна срабатывать мгновенно: backspace до
    // пустой строки иначе попадает в transition+debounce и иногда
    // визуально «не очищает» с первого раза. На пустой query reload
    // без debounce и без startTransition.
    if (!search.trim()) {
      reload()
      return
    }
    debounceRef.current = setTimeout(() => {
      startTransition(() => { reload() })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [reload, search])

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

  const toggleGroup = (key: string, e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // Scroll the clicked header into view so the next click isn't blocked
    // by a sticky/overlapping element above it.
    if (e?.currentTarget && typeof (e.currentTarget as HTMLElement).scrollIntoView === "function") {
      try {
        (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest", behavior: "smooth" })
      } catch {
        /* ignore */
      }
    }
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
      toast.error(t("linkUnavailable"))
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
      title: first?.title || t("freshFallbackTitle"),
      description: first?.description || t("freshFallbackDesc"),
      groupKey: g.key,
    }
  }, [groups, t])

  const counts = {
    all: (snap.materials || []).length,
    new: (snap.materials || []).filter((m) => isNew(m.created_at)).length,
    saved: pins.size,
    unseen: (snap.materials || []).filter((m) => isNew(m.created_at)).length,
  }

  return (
    <div className="stu-mat2">

      <div className="main-header">
        <div>
          <h1>{t("headingMy")} <span className="gl">{t("headingWord")}</span></h1>
          <div className="sub">{t("subtitle")}</div>
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
                {hero.teacherName ? t("afterTeacherWho", { name: hero.teacherName }) : t("afterTeacherLabel")}
              </div>
              <div className="ft-title">
                {t("ftPinTitle")} <span className="gl">{hero.title}</span>
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
              {t("ftCtaOpen")}
            </button>
            <button className="btn btn-ghost-dark" onClick={() => setFilter("all")}>{t("ftCtaLater")}</button>
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
            <div className="m-stat-lbl">{t("statTotal")}</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico red">
            <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          </div>
          <div>
            <div className="m-stat-val" style={{ color: "var(--red)" }}>{stats.newCount}</div>
            <div className="m-stat-lbl">{t("statNew")}</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico lime">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div className="m-stat-val">{stats.studied}</div>
            <div className="m-stat-lbl">{t("statStudied")}</div>
          </div>
        </div>
        <div className="m-stat">
          <div className="m-stat-ico dark">
            <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div className="m-stat-val"><span className="gl">+{stats.xpEarned}</span> XP</div>
            <div className="m-stat-lbl">{t("statXpEarned")}</div>
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
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs" role="tablist">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            {t("tabAll")} <span className="count-dot">{counts.all}</span>
          </button>
          <button
            className={filter === "new" ? "active" : ""}
            onClick={() => setFilter("new")}
          >
            <span className="new-dot" />{t("tabNew")} <span className="count-dot">{counts.new}</span>
          </button>
          <button
            className={filter === "saved" ? "active" : ""}
            onClick={() => setFilter("saved")}
          >
            {t("tabSaved")} <span className="count-dot">{counts.saved}</span>
          </button>
          <button
            className={filter === "unseen" ? "active" : ""}
            onClick={() => setFilter("unseen")}
          >
            {t("tabUnseen")} <span className="count-dot">{counts.unseen}</span>
          </button>
        </div>
      </div>

      {apiMissing ? (
        <div className="empty-state">
          <b>{t("apiPreparingTitle")}</b>
          {t("apiPreparingHint")}
        </div>
      ) : null}

      {/* PINNED / FAVORITES */}
      {pinnedMaterials.length > 0 ? (
        <div className="section">
          <div className="section-head">
            <div>
              <div className="section-title">{t("pinnedTitle")}</div>
              <div className="section-sub" style={{ marginTop: 4 }}>{t("pinnedSub")}</div>
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
              {t("byLessonTitle")} <span className="gl">{t("byLessonWord")}</span>
              {counts.new > 0 ? <span className="new-pill">{t("byLessonNewPill", { count: counts.new })}</span> : null}
            </div>
            <div className="section-sub" style={{ marginTop: 4 }}>
              {t("byLessonSub")}
            </div>
          </div>
        </div>

        {groups.length === 0 && !apiMissing && !loaded ? (
          <div className="empty-state">
            <b>{t("loadingTitle")}</b>
            {t("loadingHint")}
          </div>
        ) : null}

        {groups.length === 0 && !apiMissing && loaded ? (
          <div className="empty-state">
            <b>{t("emptyTitle")}</b>
            {t("emptyHint")}
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
                onClick={(e) => toggleGroup(g.key, e)}
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
                  {g.hasNew ? `+${g.items.filter((m) => isNew(m.created_at)).length} новых` : (() => {
                    const n = g.items.length;
                    const mod10 = n % 10;
                    const mod100 = n % 100;
                    const word = mod10 === 1 && mod100 !== 11 ? "материал" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "материала" : "материалов";
                    return `${n} ${word}`;
                  })()}
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
