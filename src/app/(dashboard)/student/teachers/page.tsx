"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror of /api/teachers response shapes)
// ─────────────────────────────────────────────────────────────────────────────

type Teacher = {
  id: string
  user_id: string
  full_name: string
  avatar_url: string | null
  initials: string
  bio: string | null
  specializations: string[]
  experience_years: number | null
  hourly_rate: number
  hourly_rate_rub: number
  trial_rate: number | null
  trial_rate_rub: number | null
  languages: string[]
  is_native: boolean
  rating: number
  total_reviews: number
  total_lessons: number
  is_verified: boolean
}

type TeacherDetail = Teacher & {
  education: string | null
  certificates: string[]
  video_intro_url: string | null
}

type Slot = {
  starts_at: string
  ends_at: string
  day_label: string
  time_label: string
}

type Review = {
  id: string
  rating: number
  comment: string
  created_at: string
  student: {
    full_name: string
    initials: string
    avatar_url: string | null
  }
}

type SpecKey = "all" | "general" | "business" | "ielts" | "kids" | "it"
type PriceKey = "any" | "under_1000" | "1000_1500" | "1500_2000" | "over_2000"
type NativeKey = "any" | "native" | "ru"
type SortKey = "rating" | "price_asc" | "reviews"

// Map UI spec label → array of DB specialization tag values (matches API contract).
const SPEC_TO_DB: Record<Exclude<SpecKey, "all">, string[]> = {
  general: ["general", "speaking"],
  business: ["business"],
  ielts: ["ielts", "toefl"],
  kids: ["kids", "children"],
  it: ["it", "technology"],
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (ported from teachers-page.html, scoped to .teachers-page)
// ─────────────────────────────────────────────────────────────────────────────

const TEACHERS_CSS = `
.teachers-page{max-width:1100px;margin:0 auto}

/* Header */
.teachers-page .page-header{text-align:center;margin-bottom:28px}
.teachers-page .page-header h1{font-size:1.8rem;font-weight:800;letter-spacing:-.8px;margin-bottom:4px}
.teachers-page .page-header h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.teachers-page .page-header p{font-size:.88rem;color:var(--muted)}

/* Filters bar */
.teachers-page .filters{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
.teachers-page .filter-group{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
.teachers-page .filter-label{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}
.teachers-page .filter-select{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;transition:border-color .15s;font-family:inherit;cursor:pointer}
.teachers-page .filter-select:focus{outline:none;border-color:var(--red)}
.teachers-page .filter-search{padding:10px 14px 10px 36px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);width:100%;transition:border-color .15s;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center;font-family:inherit}
.teachers-page .filter-search:focus{outline:none;border-color:var(--red)}
.teachers-page .filter-btn{padding:10px 28px;border:none;border-radius:10px;background:var(--accent-dark);color:#fff;font-size:.82rem;font-weight:700;transition:all .15s;white-space:nowrap;cursor:pointer;font-family:inherit}
.teachers-page .filter-btn:hover{background:var(--red)}

/* Sort bar */
.teachers-page .sort-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.teachers-page .sort-count{font-size:.82rem;color:var(--muted)}
.teachers-page .sort-count b{color:var(--text)}
.teachers-page .sort-tabs{display:flex;gap:4px}
.teachers-page .sort-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:.72rem;font-weight:600;color:var(--muted);transition:all .15s;cursor:pointer;font-family:inherit}
.teachers-page .sort-tab:hover{border-color:var(--text);color:var(--text)}
.teachers-page .sort-tab.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}

/* Teachers grid */
.teachers-page .teachers-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}

/* Teacher card */
.teachers-page .t-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer;text-align:left;width:100%;padding:0;font-family:inherit;color:inherit}
.teachers-page .t-card:hover{border-color:var(--red);transform:translateY(-4px);box-shadow:0 12px 30px var(--shadow)}

.teachers-page .t-photo{width:100%;aspect-ratio:4/3;background:var(--bg);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.teachers-page .t-photo-placeholder{font-size:3rem;font-weight:800;color:var(--border);letter-spacing:-2px}
.teachers-page .t-photo img{width:100%;height:100%;object-fit:cover}
.teachers-page .t-native-badge{position:absolute;top:10px;right:10px;padding:4px 10px;border-radius:8px;background:var(--lime);color:#0A0A0A;font-size:.6rem;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.teachers-page .t-online{position:absolute;bottom:10px;left:10px;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font-size:.55rem;font-weight:600;display:flex;align-items:center;gap:4px;backdrop-filter:blur(4px)}
.teachers-page .t-online-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:teachersPulse 1.8s ease-in-out infinite}
@keyframes teachersPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}

.teachers-page .t-body{padding:16px 18px}
.teachers-page .t-name{font-family:'Gluten',cursive;font-size:1.05rem;font-weight:600;color:var(--text);margin-bottom:2px}
.teachers-page .t-spec{font-size:.62rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.teachers-page .t-desc{font-size:.78rem;color:var(--muted);line-height:1.45;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.teachers-page .t-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.teachers-page .t-rating{display:flex;align-items:center;gap:4px;font-size:.8rem;font-weight:700}
.teachers-page .t-star{color:var(--lime);font-size:.7rem}
.teachers-page .t-reviews{font-size:.7rem;color:var(--muted);font-weight:500}
.teachers-page .t-price{font-size:.72rem;color:var(--muted)}
.teachers-page .t-price b{font-size:.9rem;color:var(--text)}

.teachers-page .t-book-btn{width:100%;padding:11px;border:none;border-radius:12px;background:var(--accent-dark);color:#fff;font-size:.82rem;font-weight:700;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-family:inherit}
.teachers-page .t-book-btn:hover{background:var(--red)}

/* Tags */
.teachers-page .t-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px}
.teachers-page .t-tag{padding:3px 8px;border-radius:6px;font-size:.58rem;font-weight:600;background:var(--bg);color:var(--muted)}

/* Empty / loading */
.teachers-page .empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:.9rem;background:var(--surface);border:1px dashed var(--border);border-radius:16px;margin-top:14px}
.teachers-page .empty-emoji{font-size:2rem;margin-bottom:10px;display:block}
.teachers-page .skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:teachersShimmer 1.4s ease infinite;border-radius:20px}
@keyframes teachersShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.teachers-page .skel-card{height:360px}

/* ===== PROFILE MODAL ===== */
.teachers-page .prof-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s;padding:20px}
.teachers-page .prof-overlay.open{display:flex}
.teachers-page .prof-overlay.visible{opacity:1}

.teachers-page .prof-modal{width:100%;max-width:680px;background:var(--surface);border-radius:24px;box-shadow:0 8px 0 var(--border),0 30px 60px rgba(0,0,0,.12);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;position:relative}
.teachers-page .prof-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime));z-index:2}

.teachers-page .prof-top{display:flex;gap:20px;padding:24px;border-bottom:1px solid var(--border);position:relative}
.teachers-page .prof-close{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1rem;cursor:pointer;z-index:3;font-family:inherit}
.teachers-page .prof-close:hover{border-color:var(--red);color:var(--red)}

.teachers-page .prof-avatar{width:100px;height:100px;border-radius:22px;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:800;color:var(--border);overflow:hidden}
.teachers-page .prof-avatar img{width:100%;height:100%;object-fit:cover;border-radius:22px}
.teachers-page .prof-info{flex:1;min-width:0}
.teachers-page .prof-name{font-family:'Gluten',cursive;font-size:1.4rem;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.teachers-page .prof-native{padding:3px 8px;border-radius:6px;background:var(--lime);color:#0A0A0A;font-family:'Inter',sans-serif;font-size:.6rem;font-weight:700}
.teachers-page .prof-spec{font-size:.72rem;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.teachers-page .prof-stats{display:flex;gap:16px;margin-top:12px}
.teachers-page .prof-stat{text-align:center}
.teachers-page .prof-stat-val{font-size:1.1rem;font-weight:800;line-height:1}
.teachers-page .prof-stat-lbl{font-size:.55rem;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:2px}

.teachers-page .prof-body{padding:20px 24px;overflow-y:auto;flex:1}
.teachers-page .prof-section{margin-bottom:20px}
.teachers-page .prof-section-title{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.teachers-page .prof-bio{font-size:.88rem;color:var(--text);line-height:1.7}
.teachers-page .prof-tags{display:flex;gap:6px;flex-wrap:wrap}
.teachers-page .prof-tag{padding:5px 12px;border-radius:8px;font-size:.72rem;font-weight:600;background:var(--bg);color:var(--text)}

.teachers-page .prof-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.teachers-page .prof-slot{padding:10px 8px;border-radius:10px;border:1px solid var(--border);text-align:center;transition:all .15s;cursor:pointer;background:var(--surface);font-family:inherit;color:inherit}
.teachers-page .prof-slot:hover{border-color:var(--red);background:rgba(230,57,70,.03)}
.teachers-page .prof-slot.selected{background:var(--red);border-color:var(--red);color:#fff}
.teachers-page .prof-slot-day{font-size:.6rem;color:var(--muted);font-weight:600;text-transform:uppercase}
.teachers-page .prof-slot.selected .prof-slot-day{color:rgba(255,255,255,.75)}
.teachers-page .prof-slot-time{font-size:.85rem;font-weight:700;margin-top:2px}
.teachers-page .prof-slots-empty{grid-column:1/-1;padding:16px;text-align:center;font-size:.78rem;color:var(--muted);background:var(--bg);border-radius:10px}

.teachers-page .prof-reviews{display:flex;flex-direction:column;gap:10px}
.teachers-page .prof-review{padding:14px;background:var(--bg);border-radius:14px}
.teachers-page .prof-review-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.teachers-page .prof-review-avatar{width:28px;height:28px;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;overflow:hidden}
.teachers-page .prof-review-avatar img{width:100%;height:100%;object-fit:cover;border-radius:8px}
.teachers-page .prof-review-name{font-size:.78rem;font-weight:700;flex:1}
.teachers-page .prof-review-rating{font-size:.72rem;font-weight:700;color:var(--lime-dark);display:flex;align-items:center;gap:3px}
.teachers-page .prof-review-text{font-size:.8rem;color:var(--muted);line-height:1.5;font-style:italic}

.teachers-page .prof-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px}
.teachers-page .prof-price{font-size:.78rem;color:var(--muted);flex:1}
.teachers-page .prof-price b{font-size:1.1rem;color:var(--text)}
.teachers-page .prof-book{padding:12px 28px;border:none;border-radius:12px;background:var(--red);color:#fff;font-size:.88rem;font-weight:700;box-shadow:0 3px 0 rgba(180,30,45,.35);transition:all .2s;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit}
.teachers-page .prof-book:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.35),0 10px 24px rgba(230,57,70,.12)}
.teachers-page .prof-book:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:0 3px 0 rgba(180,30,45,.35)}
.teachers-page .prof-book.success{background:var(--lime);color:#0A0A0A;box-shadow:0 3px 0 rgba(140,180,40,.4)}
.teachers-page .prof-section-loading{font-size:.78rem;color:var(--muted)}

/* Toast (booking errors) */
.teachers-page .t-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0A0A0A;color:#fff;padding:12px 22px;border-radius:12px;font-size:.82rem;font-weight:600;z-index:1100;box-shadow:0 10px 30px rgba(0,0,0,.25);animation:teachersToastIn .25s ease-out}
@keyframes teachersToastIn{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}

/* Dark theme overrides (same values used by .clubs-page) */
[data-theme="dark"] .teachers-page .filter-select{background-color:var(--bg)}
[data-theme="dark"] .teachers-page .filter-search{background-color:var(--bg)}
[data-theme="dark"] .teachers-page .sort-tab.active{background:var(--red);color:#fff;border-color:var(--red)}
[data-theme="dark"] .teachers-page .filter-btn{background:var(--red)}
[data-theme="dark"] .teachers-page .filter-btn:hover{filter:brightness(.9);background:var(--red)}
[data-theme="dark"] .teachers-page .t-book-btn{background:var(--red)}
[data-theme="dark"] .teachers-page .t-book-btn:hover{filter:brightness(.9)}
[data-theme="dark"] .teachers-page .prof-close{background:var(--surface)}
[data-theme="dark"] .teachers-page .prof-review-avatar{background:var(--surface-2)}

/* Responsive */
@media(max-width:900px){
  .teachers-page .teachers-grid{grid-template-columns:1fr 1fr}
  .teachers-page .filters{flex-wrap:wrap}
  .teachers-page .filter-group{min-width:calc(50% - 6px)}
}
@media(max-width:600px){
  .teachers-page{padding:0}
  .teachers-page .teachers-grid{grid-template-columns:1fr}
  .teachers-page .filters{flex-direction:column}
  .teachers-page .filter-group{min-width:100%}
  .teachers-page .sort-bar{flex-direction:column;gap:10px;align-items:flex-start}
  .teachers-page .prof-overlay{padding:0;align-items:flex-end}
  .teachers-page .prof-modal{border-radius:24px 24px 0 0;max-height:95vh}
  .teachers-page .prof-top{flex-direction:column;align-items:center;text-align:center}
  .teachers-page .prof-stats{justify-content:center}
  .teachers-page .prof-slots{grid-template-columns:repeat(3,1fr)}
  .teachers-page .prof-footer{flex-direction:column}
  .teachers-page .prof-book{width:100%;justify-content:center}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pluralizeTeachers(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "преподаватель"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "преподавателя"
  return "преподавателей"
}

function formatRub(rub: number): string {
  // 1 800 ₽ style (non-breaking space as thousands separator).
  return `${rub.toLocaleString("ru-RU").replace(/\s/g, "\u00A0")} ₽`
}

function shortSpecs(specs: string[]): string {
  // Render first 2 specs joined by ", ". API already returns human-readable tags.
  return specs.slice(0, 2).join(", ")
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentTeachersPage() {
  // Filter UI state (draft — applied only on "Найти" click).
  const [searchDraft, setSearchDraft] = useState("")
  const [specDraft, setSpecDraft] = useState<SpecKey>("all")
  const [priceDraft, setPriceDraft] = useState<PriceKey>("any")
  const [nativeDraft, setNativeDraft] = useState<NativeKey>("any")

  // Applied filters — only these affect the fetch.
  const [applied, setApplied] = useState<{
    search: string
    spec: SpecKey
    price: PriceKey
    native: NativeKey
    sort: SortKey
  }>({
    search: "",
    spec: "all",
    price: "any",
    native: "any",
    sort: "rating",
  })

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Modal state.
  const [modalTeacher, setModalTeacher] = useState<TeacherDetail | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Abort controllers so stale fetches don't clobber newer ones.
  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)

  // ─── Fetch list ────────────────────────────────────────────────────────────
  const loadTeachers = useCallback(
    async (params: typeof applied) => {
      listAbortRef.current?.abort()
      const ac = new AbortController()
      listAbortRef.current = ac
      setIsLoading(true)
      try {
        const q = new URLSearchParams()
        if (params.search.trim()) q.set("search", params.search.trim())
        if (params.spec !== "all") {
          q.set("spec", SPEC_TO_DB[params.spec].join(","))
        }
        if (params.price !== "any") q.set("price", params.price)
        if (params.native !== "any") q.set("native", params.native)
        q.set("sort", params.sort)
        q.set("limit", "60")

        const res = await fetch(`/api/teachers?${q.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        })
        if (!res.ok) {
          if (!ac.signal.aborted) toast.error("Не удалось загрузить преподавателей")
          return
        }
        const data = (await res.json()) as { teachers: Teacher[]; total: number }
        setTeachers(data.teachers ?? [])
        setTotal(data.total ?? 0)
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return
        console.error("[teachers page] load error:", err)
        toast.error("Не удалось загрузить преподавателей")
      } finally {
        if (!ac.signal.aborted) setIsLoading(false)
      }
    },
    []
  )

  // Initial + reactive load whenever the applied snapshot changes.
  useEffect(() => {
    loadTeachers(applied)
    return () => listAbortRef.current?.abort()
  }, [applied, loadTeachers])

  // ─── "Найти" button: commit draft filters → applied ────────────────────────
  const handleSearch = useCallback(() => {
    setApplied((prev) => ({
      ...prev,
      search: searchDraft,
      spec: specDraft,
      price: priceDraft,
      native: nativeDraft,
    }))
  }, [searchDraft, specDraft, priceDraft, nativeDraft])

  const handleSearchKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSearch()
    },
    [handleSearch]
  )

  // Sort tab → refetch immediately.
  const handleSortChange = useCallback((sort: SortKey) => {
    setApplied((prev) => ({ ...prev, sort }))
  }, [])

  // ─── Modal: open/close + fetch detail/slots/reviews ────────────────────────
  const openProfile = useCallback(async (teacher: Teacher) => {
    // Seed modal with list-row data so it renders instantly.
    setModalTeacher({
      ...teacher,
      education: null,
      certificates: [],
      video_intro_url: null,
    })
    setModalOpen(true)
    setSelectedSlot(null)
    setBookingSuccess(false)
    setSlots([])
    setReviews([])
    requestAnimationFrame(() => setModalVisible(true))

    detailAbortRef.current?.abort()
    const ac = new AbortController()
    detailAbortRef.current = ac

    setDetailLoading(true)
    setSlotsLoading(true)
    setReviewsLoading(true)

    // Detail — enriches bio/education/certificates.
    void fetch(`/api/teachers/${teacher.id}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as TeacherDetail) : null))
      .then((detail) => {
        if (detail && !ac.signal.aborted) setModalTeacher(detail)
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setDetailLoading(false)
      })

    // Slots.
    void fetch(`/api/teachers/${teacher.id}/slots?days=7&limit=8`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { slots: Slot[] }) : { slots: [] }))
      .then(({ slots: s }) => {
        if (!ac.signal.aborted) setSlots(s ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setSlotsLoading(false)
      })

    // Reviews.
    void fetch(`/api/teachers/${teacher.id}/reviews?limit=10`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { reviews: Review[] }) : { reviews: [] }))
      .then(({ reviews: r }) => {
        if (!ac.signal.aborted) setReviews(r ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setReviewsLoading(false)
      })
  }, [])

  const closeProfile = useCallback(() => {
    setModalVisible(false)
    detailAbortRef.current?.abort()
    window.setTimeout(() => {
      setModalOpen(false)
      setModalTeacher(null)
      setSlots([])
      setReviews([])
      setSelectedSlot(null)
      setBookingSuccess(false)
    }, 300)
  }, [])

  // ESC closes modal.
  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfile()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modalOpen, closeProfile])

  // Lock body scroll when modal is open.
  useEffect(() => {
    if (!modalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [modalOpen])

  // ─── Book lesson ───────────────────────────────────────────────────────────
  const bookLesson = useCallback(async () => {
    if (!modalTeacher || !selectedSlot || booking) return
    setBooking(true)
    try {
      // /api/booking/create expects auth user_id as teacherId and string duration.
      // Slot length (starts_at → ends_at) is 50 min from the slots API.
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: modalTeacher.user_id,
          scheduledAt: selectedSlot.starts_at,
          durationMinutes: "50",
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        redirectUrl?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? "Не удалось записаться")
        setBooking(false)
        return
      }
      setBookingSuccess(true)
      toast.success("Ты записан на урок!")
      // Brief success flash, then either redirect to payment or just close.
      window.setTimeout(() => {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl
        } else {
          closeProfile()
          setBooking(false)
        }
      }, 1200)
    } catch (err) {
      console.error("[teachers page] booking error:", err)
      toast.error("Не удалось записаться")
      setBooking(false)
    }
  }, [modalTeacher, selectedSlot, booking, closeProfile])

  // ─── Derived UI bits ───────────────────────────────────────────────────────
  const headerCount = total

  const bookBtnLabel = useMemo(() => {
    if (bookingSuccess) return "✓ Записано!"
    if (booking) return "…"
    if (selectedSlot) return `Записаться на ${selectedSlot.time_label}`
    return "Записаться на урок"
  }, [bookingSuccess, booking, selectedSlot])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="teachers-page">
      <style dangerouslySetInnerHTML={{ __html: TEACHERS_CSS }} />

      {/* Header */}
      <div className="page-header">
        <h1>
          Найди своего <span className="gl">teacher</span>
        </h1>
        <p>
          {headerCount} профессиональных teachers английского языка
        </p>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group" style={{ flex: 1.5 }}>
          <label className="filter-label" htmlFor="teachers-search">
            Поиск
          </label>
          <input
            id="teachers-search"
            className="filter-search"
            type="text"
            placeholder="Имя, специализация..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={handleSearchKey}
            aria-label="Поиск преподавателя"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="teachers-spec">
            Специализация
          </label>
          <select
            id="teachers-spec"
            className="filter-select"
            value={specDraft}
            onChange={(e) => setSpecDraft(e.target.value as SpecKey)}
          >
            <option value="all">Все</option>
            <option value="general">General English</option>
            <option value="business">Business</option>
            <option value="ielts">IELTS / TOEFL</option>
            <option value="kids">Для детей</option>
            <option value="it">IT English</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="teachers-price">
            Цена
          </label>
          <select
            id="teachers-price"
            className="filter-select"
            value={priceDraft}
            onChange={(e) => setPriceDraft(e.target.value as PriceKey)}
          >
            <option value="any">Любая</option>
            <option value="under_1000">до 1 000 ₽</option>
            <option value="1000_1500">1 000 – 1 500 ₽</option>
            <option value="1500_2000">1 500 – 2 000 ₽</option>
            <option value="over_2000">от 2 000 ₽</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="teachers-native">
            Носитель
          </label>
          <select
            id="teachers-native"
            className="filter-select"
            value={nativeDraft}
            onChange={(e) => setNativeDraft(e.target.value as NativeKey)}
          >
            <option value="any">Не важно</option>
            <option value="native">Native speaker</option>
            <option value="ru">Русскоязычный</option>
          </select>
        </div>
        <button type="button" className="filter-btn" onClick={handleSearch}>
          Найти
        </button>
      </div>

      {/* Sort bar */}
      <div className="sort-bar">
        <div className="sort-count">
          Найдено: <b>{headerCount}</b> {pluralizeTeachers(headerCount)}
        </div>
        <div className="sort-tabs" role="tablist" aria-label="Сортировка">
          <SortTab
            active={applied.sort === "rating"}
            onClick={() => handleSortChange("rating")}
          >
            По рейтингу
          </SortTab>
          <SortTab
            active={applied.sort === "price_asc"}
            onClick={() => handleSortChange("price_asc")}
          >
            По цене ↑
          </SortTab>
          <SortTab
            active={applied.sort === "reviews"}
            onClick={() => handleSortChange("reviews")}
          >
            По отзывам
          </SortTab>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="teachers-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skel-card" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <div className="empty">
          <span className="empty-emoji">🔍</span>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Пока никого не нашли
          </div>
          <div style={{ fontSize: ".78rem" }}>
            Попробуй изменить фильтры или сбросить поиск.
          </div>
        </div>
      ) : (
        <div className="teachers-grid">
          {teachers.map((t) => (
            <TeacherCard
              key={t.id}
              teacher={t}
              onOpen={() => openProfile(t)}
            />
          ))}
        </div>
      )}

      {/* Profile modal */}
      {modalOpen && modalTeacher ? (
        <div
          className={`prof-overlay open${modalVisible ? " visible" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeProfile()
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Профиль: ${modalTeacher.full_name}`}
        >
          <div className="prof-modal">
            <div className="prof-top">
              <button
                type="button"
                className="prof-close"
                onClick={closeProfile}
                aria-label="Закрыть"
              >
                ✕
              </button>
              <div className="prof-avatar">
                {modalTeacher.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={modalTeacher.avatar_url}
                    alt={modalTeacher.full_name}
                  />
                ) : (
                  modalTeacher.initials || "?"
                )}
              </div>
              <div className="prof-info">
                <div className="prof-name">
                  {modalTeacher.full_name}
                  {modalTeacher.is_native ? (
                    <span className="prof-native">Native</span>
                  ) : null}
                </div>
                <div className="prof-spec">
                  {modalTeacher.specializations.slice(0, 3).join(", ") || "—"}
                  {modalTeacher.experience_years != null
                    ? ` · ${modalTeacher.experience_years} лет опыта`
                    : ""}
                </div>
                <div className="prof-stats">
                  <div className="prof-stat">
                    <div className="prof-stat-val">
                      {modalTeacher.rating.toFixed(1)}
                    </div>
                    <div className="prof-stat-lbl">Рейтинг</div>
                  </div>
                  <div className="prof-stat">
                    <div className="prof-stat-val">
                      {modalTeacher.total_lessons.toLocaleString("ru-RU")}
                    </div>
                    <div className="prof-stat-lbl">Уроков</div>
                  </div>
                  <div className="prof-stat">
                    <div className="prof-stat-val">
                      {modalTeacher.total_reviews}
                    </div>
                    <div className="prof-stat-lbl">Отзывов</div>
                  </div>
                  <div className="prof-stat">
                    <div className="prof-stat-val">
                      {Math.max(
                        1,
                        modalTeacher.total_lessons > 0
                          ? Math.round(modalTeacher.total_lessons / 26)
                          : modalTeacher.total_reviews
                      )}
                    </div>
                    <div className="prof-stat-lbl">Учеников</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="prof-body">
              <div className="prof-section">
                <div className="prof-section-title">О преподавателе</div>
                {detailLoading && !modalTeacher.bio ? (
                  <div className="prof-section-loading">Загрузка…</div>
                ) : (
                  <div className="prof-bio">
                    {modalTeacher.bio || "Преподаватель пока не добавил описание."}
                  </div>
                )}
              </div>

              {modalTeacher.specializations.length > 0 ? (
                <div className="prof-section">
                  <div className="prof-section-title">Специализация</div>
                  <div className="prof-tags">
                    {modalTeacher.specializations.map((s) => (
                      <span key={s} className="prof-tag">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="prof-section">
                <div className="prof-section-title">Ближайшие слоты</div>
                <div className="prof-slots">
                  {slotsLoading ? (
                    <div className="prof-slots-empty">Загружаем расписание…</div>
                  ) : slots.length === 0 ? (
                    <div className="prof-slots-empty">
                      Свободных слотов на ближайшую неделю нет.
                    </div>
                  ) : (
                    slots.map((s) => (
                      <button
                        key={s.starts_at}
                        type="button"
                        className={`prof-slot${selectedSlot?.starts_at === s.starts_at ? " selected" : ""}`}
                        onClick={() => setSelectedSlot(s)}
                        aria-pressed={selectedSlot?.starts_at === s.starts_at}
                      >
                        <div className="prof-slot-day">{s.day_label}</div>
                        <div className="prof-slot-time">{s.time_label}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="prof-section">
                <div className="prof-section-title">Отзывы учеников</div>
                <div className="prof-reviews">
                  {reviewsLoading ? (
                    <div className="prof-section-loading">Загрузка…</div>
                  ) : reviews.length === 0 ? (
                    <div className="prof-section-loading">Отзывов пока нет.</div>
                  ) : (
                    reviews.map((r) => (
                      <div key={r.id} className="prof-review">
                        <div className="prof-review-top">
                          <div className="prof-review-avatar">
                            {r.student.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.student.avatar_url}
                                alt={r.student.full_name}
                              />
                            ) : (
                              r.student.initials ||
                              r.student.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="prof-review-name">
                            {r.student.full_name}
                          </div>
                          <div className="prof-review-rating">
                            ★ {r.rating.toFixed(1)}
                          </div>
                        </div>
                        <div className="prof-review-text">{r.comment}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="prof-footer">
              <div className="prof-price">
                <b>{formatRub(modalTeacher.hourly_rate_rub)}</b> / 60 мин
              </div>
              <button
                type="button"
                className={`prof-book${bookingSuccess ? " success" : ""}`}
                onClick={bookLesson}
                disabled={!selectedSlot || booking || bookingSuccess}
              >
                {bookBtnLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function SortTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`sort-tab${active ? " active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function TeacherCard({
  teacher,
  onOpen,
}: {
  teacher: Teacher
  onOpen: () => void
}) {
  const specLabel = shortSpecs(teacher.specializations).toUpperCase()
  const tags = teacher.specializations.slice(0, 3)

  return (
    <div
      className="t-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`Открыть профиль: ${teacher.full_name}`}
    >
      <div className="t-photo">
        {teacher.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teacher.avatar_url} alt={teacher.full_name} />
        ) : (
          <div className="t-photo-placeholder">
            {teacher.initials || "?"}
          </div>
        )}
        {teacher.is_native ? (
          <div className="t-native-badge">Native</div>
        ) : null}
        <div className="t-online">
          <div className="t-online-dot" />
          Онлайн
        </div>
      </div>
      <div className="t-body">
        <div className="t-name">{teacher.full_name}</div>
        <div className="t-spec">{specLabel || "ПРЕПОДАВАТЕЛЬ"}</div>
        {teacher.bio ? <div className="t-desc">{teacher.bio}</div> : null}
        {tags.length > 0 ? (
          <div className="t-tags">
            {tags.map((tag) => (
              <span key={tag} className="t-tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="t-meta">
          <div className="t-rating">
            <span className="t-star">★</span>
            {teacher.rating.toFixed(1)}{" "}
            <span className="t-reviews">({teacher.total_reviews})</span>
          </div>
          <div className="t-price">
            <b>{formatRub(teacher.hourly_rate_rub)}</b> / 60 мин
          </div>
        </div>
        <button
          type="button"
          className="t-book-btn"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          Записаться
        </button>
      </div>
    </div>
  )
}
