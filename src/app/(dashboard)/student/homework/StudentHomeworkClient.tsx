// @ts-nocheck
"use client"

import "@/styles/dashboard/student-homework.css"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { format, differenceInCalendarDays } from "date-fns"
import { ru } from "date-fns/locale"
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

const MONTH_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
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

function humanDueLabel(due: string, ui: string): string {
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return ""
  if (ui === "submitted") return "сдано"
  if (ui === "reviewed") {
    const days = Math.abs(differenceInCalendarDays(new Date(), d))
    if (days === 0) return "сегодня"
    if (days === 1) return "1 день"
    if (days < 5) return `${days} дня`
    return `${days} дней`
  }
  const days = differenceInCalendarDays(d, new Date())
  if (days < 0) {
    const n = Math.abs(days)
    if (n === 1) return "вчера"
    return `-${n} ${n < 5 ? "дня" : "дней"}`
  }
  if (days === 0) return "сегодня"
  if (days === 1) return "завтра"
  if (days < 5) return `${days} дня`
  return `${days} дней`
}

function dateSquareClass(ui: string): string {
  if (ui === "overdue") return "overdue"
  if (ui === "soon") return "soon"
  if (ui === "reviewed") return "done"
  return ""
}

function statusPillLabel(ui: string): { cls: string; text: string } {
  switch (ui) {
    case "overdue":
      return { cls: "overdue", text: "просрочено" }
    case "soon":
      return { cls: "soon", text: "⏱ срок скоро" }
    case "submitted":
      return { cls: "submitted", text: "⏳ проверяется" }
    case "reviewed":
      return { cls: "graded", text: "✓ проверено" }
    case "todo":
    default:
      return { cls: "todo", text: "в работе" }
  }
}

function gradeColorClass(score: number | null): string {
  if (score === null) return ""
  if (score >= 8) return ""
  if (score >= 5) return "mid"
  return "low"
}

function formatDateInputLocal(iso: string | null): string {
  if (!iso) return ""
  try {
    return format(new Date(iso), "d MMMM, HH:mm", { locale: ru })
  } catch {
    return ""
  }
}

export default function StudentHomeworkClient({ initial }: { initial: Snapshot }) {
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
              Моя <span className="gl">homework</span>
            </h1>
            <div className="sub">
              {counts.todo > 0 ? `${counts.todo} ждут тебя` : "свободно"}
              {counts.submitted > 0 ? ` · ${counts.submitted} проверяется` : ""}
              {counts.reviewed > 0 ? ` · ${counts.reviewed} разобрано` : ""}
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
                    ? "просрочено — надо срочно"
                    : `ближайший дедлайн · ${humanDueLabel(urgent.due_date, urgent.ui_status)}`}
                </div>
                <div className="uh-title">{urgent.title}</div>
                <div className="uh-sub">
                  {urgent.description
                    ? String(urgent.description).slice(0, 160) +
                      (String(urgent.description).length > 160 ? "…" : "")
                    : `Сдать до ${formatDateInputLocal(urgent.due_date)}`}
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
                Сдать работу
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
              <div className="h-stat-lbl">Ждут тебя</div>
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
              <div className="h-stat-lbl">На проверке</div>
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
              <div className="h-stat-lbl">Проверено</div>
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
              <div className="h-stat-lbl">За этот месяц</div>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => changeFilter("all")}
          >
            Все <span className="count-dot">{counts.all}</span>
          </button>
          <button
            className={filter === "todo" ? "active" : ""}
            onClick={() => changeFilter("todo")}
          >
            {counts.todo > 0 ? <span className="pulse-dot"></span> : null}
            Надо сделать <span className="count-dot">{counts.todo}</span>
          </button>
          <button
            className={filter === "submitted" ? "active" : ""}
            onClick={() => changeFilter("submitted")}
          >
            На проверке <span className="count-dot">{counts.submitted}</span>
          </button>
          <button
            className={filter === "reviewed" ? "active" : ""}
            onClick={() => changeFilter("reviewed")}
          >
            Проверенные <span className="count-dot">{counts.reviewed}</span>
          </button>
        </div>

        {/* Empty state */}
        {totalVisible === 0 ? (
          <div className="empty-state">
            <b>Здесь пусто</b>
            Когда преподаватель выдаст задание — оно появится тут.
          </div>
        ) : null}

        {/* TODO */}
        {showTodo && todoList.length > 0 ? (
          <div className="section">
            <div className="section-head">
              <div>
                <div className="section-title">
                  Надо <span className="gl">to do</span>
                </div>
                <div className="section-sub">
                  Сделай эти задания — преподаватель ждёт
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
                  На <span className="gl">review</span>
                </div>
                <div className="section-sub">
                  Ты сдал — ждём фидбэк. Обычно это 1–2 дня
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
                  <span className="gl">Reviewed</span> — с фидбэком
                </div>
                <div className="section-sub">
                  Преподаватель разобрал твои работы — посмотри комментарии
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
              toast.success("Работа отправлена преподавателю")
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
  const due = new Date(item.due_date)
  const day = isNaN(due.getTime()) ? "–" : String(due.getDate()).padStart(2, "0")
  const mon = isNaN(due.getTime()) ? "" : MONTH_SHORT[due.getMonth()]
  const dateStatus = humanDueLabel(item.due_date, item.ui_status)

  const pill = statusPillLabel(item.ui_status)
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
              К уроку с <b>{item.teacher_name}</b> ·{" "}
              {format(new Date(item.lesson_at), "d MMM", { locale: ru })}
            </span>
          ) : (
            <span className="hw-lesson-tag">
              От <b>{item.teacher_name}</b>
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
            <b>до {formatDateInputLocal(item.due_date)}</b>
          </span>
          {item.attachments.length > 0 ? (
            <span className="m-item">
              <svg viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {item.attachments.length === 1
                ? "1 файл"
                : `${item.attachments.length} файлов`}
            </span>
          ) : null}
          {item.ui_status === "submitted" ? (
            <span className="m-item">XP зачислится после проверки</span>
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
                Сдать работу
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onOpen}>
                Открыть
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-outline" onClick={onOpen}>
                Посмотреть работу
              </button>
              <span className="hw-cta-hint">нельзя редактировать</span>
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

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
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
      toast.error("Ссылка должна начинаться с http(s)://")
      return
    }
    const name = linkName.trim() || url.replace(/^https?:\/\//i, "").slice(0, 60)
    setAttachments((prev) => [...prev, { name, url }])
    setLinkName("")
    setLinkUrl("")
  }

  async function uploadSingleFile(file: File): Promise<Attachment | null> {
    if (file.size === 0) {
      toast.error(`Файл «${file.name}» пуст`)
      return null
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`«${file.name}» больше 50 МБ`)
      return null
    }
    const mime = file.type || "application/octet-stream"
    if (!isAcceptableMime(mime)) {
      toast.error(`Формат «${mime}» не поддерживается`)
      return null
    }

    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      toast.error("Нужно войти в аккаунт")
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
      console.error("Ошибка загрузки файла:", upErr)
      toast.error(upErr.message || `Не удалось загрузить «${file.name}»`)
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
      toast.error("Не удалось получить ссылку на файл")
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
      toast.error("Сбой при загрузке файлов")
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
      toast.error("Подожди, файл ещё загружается")
      return
    }
    if (!text.trim() && attachments.length === 0) {
      toast.error("Прикрепи файл, ссылку или напиши ответ")
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
        toast.error(j?.error || "Не удалось отправить задание")
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
        <h2>Сдать работу</h2>
        <div className="modal-sub">{item.title}</div>

        <div className="field">
          <label>Ответ</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Напиши ответ, пришли текст, ссылку на документ или расскажи, что сделал"
            rows={6}
          />
        </div>

        <div className="field">
          <label>Прикрепить файл</label>
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
              {uploading > 0 ? "Загружаю…" : "Выбрать файл"}
            </button>
            {uploading > 0 ? (
              <span className="upload-status">
                <span className="spin" />
                Загружается {uploading}…
              </span>
            ) : (
              <span className="upload-status">
                Фото, PDF, документы, аудио или видео · до 50 МБ
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
          <label>Или прикрепить ссылку (Google Docs, сайт)</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <input
              type="text"
              placeholder="Название"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
            />
            <input
              type="url"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addLink}>
              +
            </button>
          </div>
          <div className="hint">Можно добавить несколько ссылок</div>
        </div>

        {attachments.length > 0 ? (
          <div className="field">
            <label>Что прикреплено</label>
            {attachments.map((a, i) => (
              <div className="attach-row" key={i}>
                <span className="nm">{a.name}</span>
                {a.size ? <span className="sz">{formatBytes(a.size)}</span> : null}
                <button
                  type="button"
                  className="rm"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Убрать"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-lime"
            onClick={submit}
            disabled={busy || uploading > 0}
          >
            {busy ? "Отправляю…" : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewModal({ item, onClose }: { item: HwItem; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{item.title}</h2>
        <div className="modal-sub">
          От {item.teacher_name} · до {formatDateInputLocal(item.due_date)}
        </div>

        {item.description ? (
          <div className="field">
            <label>Описание</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.description}
            </div>
          </div>
        ) : null}

        {item.attachments.length > 0 ? (
          <div className="field">
            <label>Материалы преподавателя</label>
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
            <label>Твой ответ</label>
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {item.submission_text}
            </div>
          </div>
        ) : null}

        {item.ui_status === "reviewed" && item.teacher_feedback ? (
          <div className="field">
            <label>Комментарий преподавателя</label>
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
                Оценка: <b style={{ color: "var(--text)" }}>{item.score_10}/10</b>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
