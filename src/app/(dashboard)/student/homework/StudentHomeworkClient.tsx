// @ts-nocheck
"use client"

import "@/styles/dashboard/student-homework.css"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format, differenceInCalendarDays } from "date-fns"
import { ru, enUS } from "date-fns/locale"
import { useLocale, useTranslations } from "next-intl"
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client"
import { createSignedUrl } from "@/lib/supabase/signed-url"

type Attachment = {
  name: string
  url: string
  size?: number
  mime?: string
}

type HwItem = {
  id: string
  teacher_id: string
  teacher_name: string
  teacher_avatar: string | null
  lesson_id: string | null
  lesson_at: string | null
  title: string
  description: string | null
  due_date: string
  status: "pending" | "in_progress" | "submitted" | "reviewed" | "overdue"
  ui_status: "todo" | "soon" | "overdue" | "submitted" | "reviewed"
  submission_text: string | null
  teacher_feedback: string | null
  grade: number | null
  score_10: number | null
  submitted_at: string | null
  reviewed_at: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
}

type Snapshot = {
  homework: HwItem[]
  counts: { all: number; todo: number; submitted: number; reviewed: number }
  stats: {
    xp_this_month: number
    reviewed_lifetime: number
    waiting: number
    in_review: number
  }
  urgent: any | null
}

type FilterKey = "all" | "todo" | "submitted" | "reviewed"

const MONTH_SHORT_RU = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
]
const MONTH_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function initialsOf(name: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function humanDueLabel(due: string, ui: string, tm: (k: string, p?: any) => string): string {
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return ""
  if (ui === "submitted") return tm("submitted")
  if (ui === "reviewed") {
    const days = Math.abs(differenceInCalendarDays(new Date(), d))
    if (days === 0) return tm("today")
    if (days === 1) return tm("daysOne")
    if (days < 5) return tm("daysFew", { n: days })
    return tm("daysMany", { n: days })
  }
  const days = differenceInCalendarDays(d, new Date())
  if (days < 0) {
    const n = Math.abs(days)
    if (n === 1) return tm("yesterday")
    return n < 5 ? tm("agoFew", { n }) : tm("agoMany", { n })
  }
  if (days === 0) return tm("today")
  if (days === 1) return tm("tomorrow")
  if (days < 5) return tm("daysFew", { n: days })
  return tm("daysMany", { n: days })
}

function dateSquareClass(ui: string): string {
  if (ui === "overdue") return "overdue"
  if (ui === "soon") return "soon"
  if (ui === "reviewed") return "done"
  return ""
}

function statusPillLabel(ui: string, tp: (k: string) => string): { cls: string; text: string } {
  switch (ui) {
    case "overdue":
      return { cls: "overdue", text: tp("overdue") }
    case "soon":
      return { cls: "soon", text: tp("soon") }
    case "submitted":
      return { cls: "submitted", text: tp("submitted") }
    case "reviewed":
      return { cls: "graded", text: tp("graded") }
    case "todo":
    default:
      return { cls: "todo", text: tp("todo") }
  }
}

function gradeColorClass(score: number | null): string {
  if (score === null) return ""
  if (score >= 8) return ""
  if (score >= 5) return "mid"
  return "low"
}

function formatDateInputLocal(iso: string | null, locale: string = "ru"): string {
  if (!iso) return ""
  try {
    return format(new Date(iso), "d MMMM, HH:mm", { locale: locale === "ru" ? ru : enUS })
  } catch {
    return ""
  }
}

export default function StudentHomeworkClient({ initial }: { initial: Snapshot }) {
  const t = useTranslations("dashboard.student.homework")
  const tHd = useTranslations("dashboard.student.homework.humanDue")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [items, setItems] = useState<HwItem[]>(initial.homework)
  const [counts, setCounts] = useState(initial.counts)
  const [stats, setStats] = useState(initial.stats)
  const [urgent, setUrgent] = useState<any | null>(initial.urgent)
  const [busy, setBusy] = useState(false)
  const [submitFor, setSubmitFor] = useState<HwItem | null>(null)
  const [viewOnly, setViewOnly] = useState<HwItem | null>(null)

  // Refresh from API after mutations
  async function reload(nextFilter: FilterKey = filter) {
    try {
      const res = await fetch(
        `/api/student/homework?filter=${nextFilter}&sort=due_soon`,
        { cache: "no-store" }
      )
      if (!res.ok) return
      const j = await res.json()
      setItems(Array.isArray(j.homework) ? j.homework : [])
      setCounts({ ...initial.counts, ...(j.counts ?? {}) })
      setStats({ ...initial.stats, ...(j.stats ?? {}) })
      setUrgent(j.urgent ?? null)
    } catch {
      /* noop */
    }
  }

  function changeFilter(next: FilterKey) {
    if (next === filter) return
    setFilter(next)
    reload(next)
  }

  // Split into sections
  const { todoList, submittedList, reviewedList } = useMemo(() => {
    const todoList: HwItem[] = []
    const submittedList: HwItem[] = []
    const reviewedList: HwItem[] = []
    for (const it of items) {
      if (it.ui_status === "submitted") submittedList.push(it)
      else if (it.ui_status === "reviewed") reviewedList.push(it)
      else todoList.push(it)
    }
    return { todoList, submittedList, reviewedList }
  }, [items])

  const showTodo = filter === "all" || filter === "todo"
  const showSubmitted = filter === "all" || filter === "submitted"
  const showReviewed = filter === "all" || filter === "reviewed"

  const totalVisible =
    (showTodo ? todoList.length : 0) +
    (showSubmitted ? submittedList.length : 0) +
    (showReviewed ? reviewedList.length : 0)

  return (
    <>
      <div className="stu-hw">
        <div className="sh-hdr">
          <div>
            <h1>
              {t("headingMy")} <span className="gl">{t("headingWord")}</span>
            </h1>
            <div className="sub">
              {counts.todo > 0 ? t("subWaiting", { count: counts.todo }) : t("subFree")}
              {counts.submitted > 0 ? t("subInReview", { count: counts.submitted }) : ""}
              {counts.reviewed > 0 ? t("subReviewed", { count: counts.reviewed }) : ""}
            </div>
          </div>
        </div>

        {/* URGENT HERO */}
        {urgent && counts.todo > 0 ? (
          <div className="urgent-hero">
            <div className="uh-bignum">{counts.todo}</div>
            <div className="uh-who">
              <div className="uh-avatar">
                {urgent.teacher_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urgent.teacher_avatar} alt="" />
                ) : (
                  initialsOf(urgent.teacher_name)
                )}
              </div>
              <div className="uh-info">
                <div className="uh-label">
                  <span className="pulse"></span>
                  {urgent.ui_status === "overdue"
                    ? t("urgentOverdue")
                    : t("urgentNearestDeadline", { when: humanDueLabel(urgent.due_date, urgent.ui_status, tHd) })}
                </div>
                <div className="uh-title">{urgent.title}</div>
                <div className="uh-sub">
                  {urgent.description
                    ? String(urgent.description).slice(0, 160) +
                      (String(urgent.description).length > 160 ? "…" : "")
                    : t("urgentDueLine", { date: formatDateInputLocal(urgent.due_date) })}
                </div>
              </div>
            </div>
            <div className="uh-actions">
              <button
                type="button"
                className="btn btn-lime"
                onClick={() => {
                  const target = items.find((x) => x.id === urgent.id)
                  if (target) setSubmitFor(target)
                }}
              >
                {t("urgentSubmitCta")}
              </button>
            </div>
          </div>
        ) : null}

        {/* STATS */}
        <div className="hw-stats">
          <div className="h-stat">
            <div className="h-stat-ico red">
              <svg viewBox="0 0 24 24">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">{stats.waiting}</div>
              <div className="h-stat-lbl">{t("statWaiting")}</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico amber">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val" style={{ color: "#F59E0B" }}>
                {stats.in_review}
              </div>
              <div className="h-stat-lbl">{t("statInReview")}</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico lime">
              <svg viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">{stats.reviewed_lifetime}</div>
              <div className="h-stat-lbl">{t("statReviewed")}</div>
            </div>
          </div>
          <div className="h-stat">
            <div className="h-stat-ico dark">
              <svg viewBox="0 0 24 24">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <div className="h-stat-val">
                <span className="gl">+{stats.xp_this_month}</span> XP
              </div>
              <div className="h-stat-lbl">{t("statXpMonth")}</div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => changeFilter("all")}
          >
            {t("tabAll")} <span className="count-dot">{counts.all}</span>
          </button>
          <button
            className={filter === "todo" ? "active" : ""}
            onClick={() => changeFilter("todo")}
          >
            {counts.todo > 0 ? <span className="pulse-dot"></span> : null}
            {t("tabTodo")} <span className="count-dot">{counts.todo}</span>
          </button>
          <button
            className={filter === "submitted" ? "active" : ""}
            onClick={() => changeFilter("submitted")}
          >
            {t("tabSubmitted")} <span className="count-dot">{counts.submitted}</span>
          </button>
          <button
            className={filter === "reviewed" ? "active" : ""}
            onClick={() => changeFilter("reviewed")}
          >
            {t("tabReviewed")} <span className="count-dot">{counts.reviewed}</span>
          </button>
        </div>

        {/* Empty state */}
        {totalVisible === 0 ? (
          <div className="empty-state">
            <b>{t("emptyTitle")}</b>
            {t("emptyHint")}
          </div>
        ) : null}

        {/* TODO */}
        {showTodo && todoList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  {t("sectionTodoTitle")} <span className="gl">{t("sectionTodoWord")}</span>
                </div>
                <div className="section-sub">
                  {t("sectionTodoSub")}
                </div>
              </div>
            </div>
            <div className="hw-list">
              {todoList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* SUBMITTED */}
        {showSubmitted && submittedList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  {t("sectionSubmittedTitle")} <span className="gl">{t("sectionSubmittedWord")}</span>
                </div>
                <div className="section-sub">
                  {t("sectionSubmittedSub")}
                </div>
              </div>
            </div>
            <div className="hw-list">
              {submittedList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* REVIEWED */}
        {showReviewed && reviewedList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  <span className="gl">{t("sectionReviewedWord")}</span>{t("sectionReviewedTitle")}
                </div>
                <div className="section-sub">
                  {t("sectionReviewedSub")}
                </div>
              </div>
            </div>
            <div className="hw-list">
              {reviewedList.map((it) => (
                <HwCard
                  key={it.id}
                  item={it}
                  onSubmit={() => setSubmitFor(it)}
                  onOpen={() => setViewOnly(it)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {submitFor ? (
          <SubmitModal
            item={submitFor}
            busy={busy}
            onClose={() => setSubmitFor(null)}
            onSubmitted={async () => {
              setSubmitFor(null)
              await reload()
              toast.success(t("submittedToast"))
            }}
            setBusy={setBusy}
          />
        ) : null}

        {viewOnly ? (
          <ViewModal item={viewOnly} onClose={() => setViewOnly(null)} />
        ) : null}
      </div>
    </>
  )
}

function HwCard({
  item,
  onSubmit,
  onOpen,
}: {
  item: HwItem
  onSubmit: () => void
  onOpen: () => void
}) {
  const tHw = useTranslations("dashboard.student.homework")
  const tHd = useTranslations("dashboard.student.homework.humanDue")
  const tSp = useTranslations("dashboard.student.homework.statusPill")
  const tCard = useTranslations("dashboard.student.homework.card")
  const locale = useLocale()
  const MONTH_SHORT = locale === "ru" ? MONTH_SHORT_RU : MONTH_SHORT_EN
  const dateLocale = locale === "ru" ? ru : enUS
  const due = new Date(item.due_date)
  const day = isNaN(due.getTime()) ? "–" : String(due.getDate()).padStart(2, "0")
  const mon = isNaN(due.getTime()) ? "" : MONTH_SHORT[due.getMonth()]
  const dateStatus = humanDueLabel(item.due_date, item.ui_status, tHd)

  const pill = statusPillLabel(item.ui_status, tSp)
  const cardClass = ["hw-card"]
  if (item.ui_status === "overdue") cardClass.push("overdue")
  else if (item.ui_status === "soon") cardClass.push("soon")
  else if (item.ui_status === "submitted") cardClass.push("submitted")
  else if (item.ui_status === "reviewed") cardClass.push("graded")

  const dateCls = ["hw-date", dateSquareClass(item.ui_status)].filter(Boolean).join(" ")

  const canSubmit =
    item.ui_status === "todo" ||
    item.ui_status === "soon" ||
    item.ui_status === "overdue"

  return (
    <div className={cardClass.join(" ")}>
      <div className={dateCls}>
        <div className="hw-date-day">{day}</div>
        <div className="hw-date-mon">{mon}</div>
        {dateStatus ? <div className="hw-date-status">{dateStatus}</div> : null}
      </div>
      <div className="hw-body">
        <div className="hw-status-row">
          <span className={`hw-status ${pill.cls}`}>{pill.text}</span>
          {item.lesson_at ? (
            <span className="hw-lesson-tag">
              {tCard("toLessonWith")} <b>{item.teacher_name}</b> ·{" "}
              {format(new Date(item.lesson_at), "d MMM", { locale: dateLocale })}
            </span>
          ) : (
            <span className="hw-lesson-tag">
              {tCard("from")} <b>{item.teacher_name}</b>
            </span>
          )}
        </div>
        <div className="hw-title">{item.title}</div>
        {item.description ? <div className="hw-desc">{item.description}</div> : null}
        <div className="hw-meta">
          <span className="m-item">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <b>{tCard("dueBy", { date: formatDateInputLocal(item.due_date, locale) })}</b>
          </span>
          {item.attachments.length > 0 ? (
            <span className="m-item">
              <svg viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {item.attachments.length === 1
                ? tCard("fileOne")
                : tCard("filesMany", { count: item.attachments.length })}
            </span>
          ) : null}
          {item.ui_status === "submitted" ? (
            <span className="m-item">{tCard("xpAfterReview")}</span>
          ) : null}
        </div>

        {item.ui_status === "reviewed" && item.teacher_feedback ? (
          <div className="hw-feedback">
            <b>{item.teacher_name}:</b> {item.teacher_feedback}
          </div>
        ) : null}
      </div>

      {item.ui_status === "reviewed" ? (
        <div className={`hw-grade ${gradeColorClass(item.score_10)}`}>
          <div className="hw-grade-num">
            {item.score_10 !== null
              ? Number.isInteger(item.score_10)
                ? String(item.score_10)
                : item.score_10.toFixed(1)
              : item.grade !== null
                ? Math.round(item.grade / 10)
                : "–"}
          </div>
          <div className="hw-grade-lbl">/ 10</div>
        </div>
      ) : (
        <div className="hw-cta">
          {canSubmit ? (
            <>
              <button
                type="button"
                className={item.ui_status === "overdue" ? "btn btn-red" : "btn btn-dark"}
                onClick={onSubmit}
              >
                {tHw("submitCta")}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpen}>
                {tHw("openCta")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={onOpen}>
                {tHw("viewSubmissionCta")}
              </button>
              <span className="hw-cta-hint">{tHw("ctaHintReadOnly")}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const HOMEWORK_BUCKET = "homework-submissions"
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
// TTL signed URL'а — 1 час (см. createSignedUrl helper). Раньше тут было
// 7 дней — это утечка: ссылка валидна и после revoke share. UI получает
// ссылку только при открытии файла, так что часа более чем хватает.

const ALLOWED_DOC_MIMES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/plain",
])

function isAcceptableMime(mime: string): boolean {
  if (!mime) return false
  if (
    mime.startsWith("image/") ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  ) {
    return true
  }
  return ALLOWED_DOC_MIMES.has(mime)
}

function safeFileName(name: string): string {
  const base = (name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file.bin"
}

function formatBytes(bytes: number | undefined, kbLabel = "KB", mbLabel = "MB"): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${kbLabel}`
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${mbLabel}`
}

function SubmitModal({
  item,
  busy,
  setBusy,
  onClose,
  onSubmitted,
}: {
  item: HwItem
  busy: boolean
  setBusy: (b: boolean) => void
  onClose: () => void
  onSubmitted: () => void
}) {
  const tm = useTranslations("dashboard.student.homework.modal")
  const [text, setText] = useState(item.submission_text || "")
  const [linkName, setLinkName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState<number>(0) // count of in-flight uploads
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function addLink() {
    const url = linkUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      toast.error(tm("errorLinkFormat"))
      return
    }
    const name = linkName.trim() || url.replace(/^https?:\/\//i, "").slice(0, 60)
    setAttachments((prev) => [...prev, { name, url }])
    setLinkName("")
    setLinkUrl("")
  }

  async function uploadSingleFile(file: File): Promise<Attachment | null> {
    if (file.size === 0) {
      toast.error(tm("errorEmptyFile", { name: file.name }))
      return null
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(tm("errorBigFile", { name: file.name }))
      return null
    }
    const mime = file.type || "application/octet-stream"
    if (!isAcceptableMime(mime)) {
      toast.error(tm("errorMimeUnsupported", { mime }))
      return null
    }

    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      toast.error(tm("errorAuth"))
      return null
    }

    const safe = safeFileName(file.name)
    const storagePath = `${user.id}/${item.id}/${Date.now()}_${safe}`

    const { error: upErr } = await supabase.storage
      .from(HOMEWORK_BUCKET)
      .upload(storagePath, file, {
        contentType: mime,
        cacheControl: "3600",
        upsert: false,
      })
    if (upErr) {
      console.error("File upload error:", upErr)
      toast.error(upErr.message || tm("errorUploadFailed", { name: file.name }))
      return null
    }

    const { signedUrl, error: signErr } = await createSignedUrl(
      supabase,
      HOMEWORK_BUCKET,
      storagePath,
    )
    if (signErr || !signedUrl) {
      // Best-effort cleanup
      await supabase.storage.from(HOMEWORK_BUCKET).remove([storagePath])
      toast.error(tm("errorSignedUrl"))
      return null
    }

    return {
      name: file.name,
      url: signedUrl,
      size: file.size,
      mime,
    }
  }

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    // Reset input so the same file can be picked again after a failure.
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (files.length === 0) return

    setUploading((n) => n + files.length)
    try {
      // Upload sequentially for better error granularity + respect RLS.
      for (const f of files) {
        const att = await uploadSingleFile(f)
        if (att) {
          setAttachments((prev) => [...prev, att])
        }
        setUploading((n) => Math.max(0, n - 1))
      }
    } catch (err) {
      console.error(err)
      toast.error(tm("errorMultiUpload"))
      setUploading(0)
    }
  }

  function triggerFilePicker() {
    if (uploading > 0 || busy) return
    fileInputRef.current?.click()
  }

  async function submit() {
    if (busy) return
    if (uploading > 0) {
      toast.error(tm("errorBusy"))
      return
    }
    if (!text.trim() && attachments.length === 0) {
      toast.error(tm("errorEmptySubmission"))
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/student/homework/${item.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_text: text || null,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j?.error || tm("errorSubmitFailed"))
        return
      }
      onSubmitted()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{tm("submitTitle")}</h2>
        <div className="modal-sub">{item.title}</div>

        <div className="field">
          <label>{tm("answerLabel")}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tm("answerPlaceholder")}
            rows={6}
          />
        </div>

        <div className="field">
          <label>{tm("attachFileLabel")}</label>
          <div className="upload-row">
            <button
              type="button"
              className="upload-btn"
              onClick={triggerFilePicker}
              aria-disabled={uploading > 0 || busy}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              {uploading > 0 ? tm("uploadingShort") : tm("pickFileCta")}
            </button>
            {uploading > 0 ? (
              <span className="upload-status">
                <span className="spin" />
                {tm("uploadingStatus", { count: uploading })}
              </span>
            ) : (
              <span className="upload-status">
                {tm("fileHint")}
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.txt"
            style={{ display: "none" }}
            onChange={onFilesPicked}
          />
        </div>

        <div className="field">
          <label>{tm("linkLabel")}</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <input
              type="text"
              placeholder={tm("linkNamePlaceholder")}
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
            />
            <input
              type="url"
              placeholder={tm("linkUrlPlaceholder")}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addLink}>
              +
            </button>
          </div>
          <div className="hint">{tm("linkHint")}</div>
        </div>

        {attachments.length > 0 ? (
          <div className="field">
            <label>{tm("attachedLabel")}</label>
            {attachments.map((a, i) => (
              <div className="attach-row" key={i}>
                <span className="nm">{a.name}</span>
                {a.size ? <span className="sz">{formatBytes(a.size, tm("unitsKB"), tm("unitsMB"))}</span> : null}
                <button
                  type="button"
                  className="rm"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label={tm("removeAria")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {tm("cancelCta")}
          </button>
          <button
            type="button"
            className="btn btn-lime"
            onClick={submit}
            disabled={busy || uploading > 0}
          >
            {busy ? tm("submittingCta") : tm("submitCta")}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewModal({ item, onClose }: { item: HwItem; onClose: () => void }) {
  const tm = useTranslations("dashboard.student.homework.modal")
  const locale = useLocale()
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{item.title}</h2>
        <div className="modal-sub">
          {tm("viewSubTemplate", {
            teacher: item.teacher_name,
            date: formatDateInputLocal(item.due_date, locale),
          })}
        </div>

        {item.description ? (
          <div className="field">
            <label>{tm("descriptionLabel")}</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.description}
            </div>
          </div>
        ) : null}

        {item.attachments.length > 0 ? (
          <div className="field">
            <label>{tm("teacherMaterialsLabel")}</label>
            {item.attachments.map((a, i) => (
              <div className="attach-row" key={i}>
                <span className="nm">
                  <a href={a.url} target="_blank" rel="noreferrer noopener">
                    {a.name}
                  </a>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {item.submission_text ? (
          <div className="field">
            <label>{tm("yourAnswerLabel")}</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.submission_text}
            </div>
          </div>
        ) : null}

        {item.ui_status === "reviewed" && item.teacher_feedback ? (
          <div className="field">
            <label>{tm("teacherFeedbackLabel")}</label>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                padding: 12,
                background: "var(--bg)",
                borderRadius: 10,
              }}
            >
              {item.teacher_feedback}
            </div>
            {item.score_10 !== null ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--muted)",
                  fontWeight: 700,
                }}
              >
                {tm("scoreLabel")} <b style={{ color: "var(--text)" }}>{item.score_10}/10</b>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {tm("closeCta")}
          </button>
        </div>
      </div>
    </div>
  )
}
