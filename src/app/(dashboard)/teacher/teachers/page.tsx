"use client"

// Каталог «Коллеги» — отдельная страница для роли teacher.
// В отличие от /student/teachers тут нет:
//   • фильтра по цене (нерелевантно коллегам);
//   • секции «Ближайшие слоты» и кнопок «Записаться» / «Оставить отзыв»;
// Зато добавлено:
//   • «Написать» (mailto:) на карточке;
//   • расширенная секция «Профиль» (опыт, языки, образование, сертификаты);
// Все лейблы перефразированы под коллегиальный тон.

import { useCallback, useEffect, useRef, useState } from "react"
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
  // /api/teachers пока не отдаёт email/is_online — оставляем optional, чтобы
  // потом расширить на бэке без рефактора UI.
  email?: string | null
  is_online?: boolean | null
}

type TeacherDetail = Teacher & {
  education: string | null
  certificates: string[]
  video_intro_url: string | null
}

type SpecKey = "all" | "general" | "business" | "ielts" | "kids" | "it"
type NativeKey = "any" | "native" | "ru"
type SortKey = "rating" | "experience" | "reviews"

// Map UI spec label → array of DB specialization tag values (matches API contract).
const SPEC_TO_DB: Record<Exclude<SpecKey, "all">, string[]> = {
  general: ["general", "speaking"],
  business: ["business"],
  ielts: ["ielts", "toefl"],
  kids: ["kids", "children"],
  it: ["it", "technology"],
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (scoped to .colleagues-page; ported из teachers-page)
// ─────────────────────────────────────────────────────────────────────────────

const COLLEAGUES_CSS = `
.colleagues-page{max-width:1100px;margin:0 auto}

/* Header */
.colleagues-page .page-header{text-align:center;margin-bottom:28px}
.colleagues-page .page-header h1{font-size:1.8rem;font-weight:800;letter-spacing:-.8px;margin-bottom:4px}
.colleagues-page .page-header h1 .gl{font-family:'Gluten',cursive;color:var(--red);font-weight:600}
.colleagues-page .page-header p{font-size:.88rem;color:var(--muted)}

/* Filters bar */
.colleagues-page .filters{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
.colleagues-page .filter-group{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
.colleagues-page .filter-label{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}
.colleagues-page .filter-select{padding:10px 14px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;transition:border-color .15s;font-family:inherit;cursor:pointer}
.colleagues-page .filter-select:focus{outline:none;border-color:var(--red)}
.colleagues-page .filter-search{padding:10px 14px 10px 36px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:.82rem;font-weight:500;color:var(--text);width:100%;transition:border-color .15s;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A8A86' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center;font-family:inherit}
.colleagues-page .filter-search:focus{outline:none;border-color:var(--red)}
.colleagues-page .filter-btn{padding:10px 28px;border:none;border-radius:10px;background:var(--accent-dark);color:#fff;font-size:.82rem;font-weight:700;transition:all .15s;white-space:nowrap;cursor:pointer;font-family:inherit}
.colleagues-page .filter-btn:hover{background:var(--red)}

/* Online-only chip */
.colleagues-page .chip-row{display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.colleagues-page .chip{padding:6px 14px;border-radius:999px;border:1px solid var(--border);background:var(--surface);font-size:.72rem;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
.colleagues-page .chip:hover{border-color:var(--text);color:var(--text)}
.colleagues-page .chip.active{background:var(--lime);color:#0A0A0A;border-color:var(--lime)}
.colleagues-page .chip-dot{width:6px;height:6px;border-radius:50%;background:#22c55e}

/* Sort bar */
.colleagues-page .sort-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.colleagues-page .sort-count{font-size:.82rem;color:var(--muted)}
.colleagues-page .sort-count b{color:var(--text)}
.colleagues-page .sort-tabs{display:flex;gap:4px}
.colleagues-page .sort-tab{padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:.72rem;font-weight:600;color:var(--muted);transition:all .15s;cursor:pointer;font-family:inherit}
.colleagues-page .sort-tab:hover{border-color:var(--text);color:var(--text)}
.colleagues-page .sort-tab.active{background:var(--accent-dark);color:#fff;border-color:var(--accent-dark)}

/* Teachers grid */
.colleagues-page .teachers-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}

/* Teacher card */
.colleagues-page .t-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer;text-align:left;width:100%;padding:0;font-family:inherit;color:inherit;display:flex;flex-direction:column}
.colleagues-page .t-card:hover{border-color:var(--red);transform:translateY(-4px);box-shadow:0 12px 30px var(--shadow)}

.colleagues-page .t-photo{width:100%;aspect-ratio:4/3;background:var(--bg);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.colleagues-page .t-photo-placeholder{font-size:3rem;font-weight:800;color:var(--border);letter-spacing:-2px}
.colleagues-page .t-photo img{width:100%;height:100%;object-fit:cover}
.colleagues-page .t-native-badge{position:absolute;top:10px;right:10px;padding:4px 10px;border-radius:8px;background:var(--lime);color:#0A0A0A;font-size:.6rem;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.colleagues-page .t-online{position:absolute;bottom:10px;left:10px;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font-size:.55rem;font-weight:600;display:flex;align-items:center;gap:4px;backdrop-filter:blur(4px)}
.colleagues-page .t-online-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:colPulse 1.8s ease-in-out infinite}
@keyframes colPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}

.colleagues-page .t-body{padding:16px 18px;display:flex;flex-direction:column;flex:1}
.colleagues-page .t-name{font-family:'Gluten',cursive;font-size:1.05rem;font-weight:600;color:var(--text);margin-bottom:2px}
.colleagues-page .t-spec{font-size:.62rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
.colleagues-page .t-desc{font-size:.78rem;color:var(--muted);line-height:1.45;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.colleagues-page .t-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.colleagues-page .t-rating{display:flex;align-items:center;gap:4px;font-size:.8rem;font-weight:700}
.colleagues-page .t-star{color:var(--lime);font-size:.7rem}
.colleagues-page .t-reviews{font-size:.7rem;color:var(--muted);font-weight:500}
.colleagues-page .t-exp{font-size:.72rem;color:var(--muted)}
.colleagues-page .t-exp b{color:var(--text);font-size:.85rem}

.colleagues-page .t-actions{display:flex;gap:6px;margin-top:auto}
.colleagues-page .t-btn{flex:1;padding:11px;border:none;border-radius:12px;font-size:.78rem;font-weight:700;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-family:inherit}
.colleagues-page .t-btn--primary{background:var(--accent-dark);color:#fff}
.colleagues-page .t-btn--primary:hover{background:var(--red)}
.colleagues-page .t-btn--ghost{background:var(--surface);color:var(--text);border:1px solid var(--border)}
.colleagues-page .t-btn--ghost:hover{border-color:var(--red);color:var(--red)}
.colleagues-page .t-btn--disabled{opacity:.5;cursor:not-allowed;pointer-events:none}

/* Tags */
.colleagues-page .t-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px}
.colleagues-page .t-tag{padding:3px 8px;border-radius:6px;font-size:.58rem;font-weight:600;background:var(--bg);color:var(--muted)}

/* Empty / loading */
.colleagues-page .empty{padding:50px 20px;text-align:center;color:var(--muted);font-size:.9rem;background:var(--surface);border:1px dashed var(--border);border-radius:16px;margin-top:14px}
.colleagues-page .empty-emoji{font-size:2rem;margin-bottom:10px;display:block}
.colleagues-page .skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:colShimmer 1.4s ease infinite;border-radius:20px}
@keyframes colShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.colleagues-page .skel-card{height:360px}

/* ===== PROFILE MODAL ===== */
.colleagues-page .prof-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s;padding:20px}
.colleagues-page .prof-overlay.open{display:flex}
.colleagues-page .prof-overlay.visible{opacity:1}

.colleagues-page .prof-modal{width:min(720px,calc(100vw - 40px));background:var(--surface);border-radius:24px;box-shadow:0 8px 0 var(--border),0 30px 60px rgba(0,0,0,.18);overflow:hidden;max-height:90vh;display:flex;flex-direction:column;position:relative}
.colleagues-page .prof-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--red),var(--lime));z-index:2}

.colleagues-page .prof-top{display:flex;flex-direction:row;align-items:flex-start;gap:20px;padding:28px 28px 24px;border-bottom:1px solid var(--border);position:relative}
.colleagues-page .prof-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1rem;cursor:pointer;z-index:3;font-family:inherit;transition:all .15s}
.colleagues-page .prof-close:hover{border-color:var(--red);color:var(--red);background:rgba(230,57,70,.06)}

.colleagues-page .prof-avatar{width:96px;height:96px;border-radius:24px;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:var(--muted);overflow:hidden;border:1px solid var(--border)}
.colleagues-page .prof-avatar img{width:100%;height:100%;object-fit:cover;border-radius:24px}
.colleagues-page .prof-info{flex:1 1 auto;min-width:0;padding-top:4px}
.colleagues-page .prof-name{font-family:'Gluten',cursive;font-size:1.5rem;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.1;letter-spacing:-.5px}
.colleagues-page .prof-native{padding:3px 8px;border-radius:6px;background:var(--lime);color:#0A0A0A;font-family:'Inter',sans-serif;font-size:.6rem;font-weight:700}
.colleagues-page .prof-spec{font-size:.72rem;color:var(--muted);margin-top:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.colleagues-page .prof-stats{display:flex;gap:18px;margin-top:14px;flex-wrap:wrap}
.colleagues-page .prof-stat{text-align:left;min-width:60px}
.colleagues-page .prof-stat-val{font-size:1.1rem;font-weight:800;line-height:1;color:var(--text)}
.colleagues-page .prof-stat-lbl{font-size:.55rem;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:4px}

.colleagues-page .prof-body{padding:24px 28px 32px;overflow-y:auto;flex:1;min-height:200px}
.colleagues-page .prof-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;color:var(--muted);font-size:.82rem;gap:8px}
.colleagues-page .prof-empty-emoji{font-size:2rem;opacity:.5}
.colleagues-page .prof-empty b{display:block;color:var(--text);font-size:1rem;margin-bottom:2px}
.colleagues-page .prof-section{margin-bottom:20px}
.colleagues-page .prof-section-title{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.colleagues-page .prof-bio{font-size:.88rem;color:var(--text);line-height:1.7;white-space:pre-wrap}
.colleagues-page .prof-tags{display:flex;gap:6px;flex-wrap:wrap}
.colleagues-page .prof-tag{padding:5px 12px;border-radius:8px;font-size:.72rem;font-weight:600;background:var(--bg);color:var(--text)}
.colleagues-page .prof-section-loading{font-size:.78rem;color:var(--muted)}

/* Profile facts grid (experience/languages/education) */
.colleagues-page .prof-facts{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.colleagues-page .prof-fact{padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:12px}
.colleagues-page .prof-fact-lbl{font-size:.6rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px}
.colleagues-page .prof-fact-val{font-size:.85rem;color:var(--text);font-weight:600;line-height:1.4}

.colleagues-page .prof-cert-list{display:flex;flex-direction:column;gap:6px}
.colleagues-page .prof-cert{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border-radius:10px;font-size:.8rem;color:var(--text)}
.colleagues-page .prof-cert::before{content:'🎓';font-size:.9rem}

.colleagues-page .prof-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;align-items:center;gap:12px;justify-content:flex-end}
.colleagues-page .prof-msg{padding:12px 28px;border:none;border-radius:12px;background:var(--red);color:#fff;font-size:.88rem;font-weight:700;box-shadow:0 3px 0 rgba(180,30,45,.35);transition:all .2s;display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit;text-decoration:none}
.colleagues-page .prof-msg:hover{transform:translateY(-2px);box-shadow:0 5px 0 rgba(180,30,45,.35),0 10px 24px rgba(230,57,70,.12);color:#fff}
.colleagues-page .prof-msg--disabled{opacity:.55;cursor:not-allowed;pointer-events:none}

/* Dark theme overrides */
[data-theme="dark"] .colleagues-page .filter-select{background-color:var(--bg)}
[data-theme="dark"] .colleagues-page .filter-search{background-color:var(--bg)}
[data-theme="dark"] .colleagues-page .sort-tab.active{background:var(--red);color:#fff;border-color:var(--red)}
[data-theme="dark"] .colleagues-page .filter-btn{background:var(--red)}
[data-theme="dark"] .colleagues-page .filter-btn:hover{filter:brightness(.9);background:var(--red)}
[data-theme="dark"] .colleagues-page .t-btn--primary{background:var(--red)}
[data-theme="dark"] .colleagues-page .t-btn--primary:hover{filter:brightness(.9)}
[data-theme="dark"] .colleagues-page .prof-close{background:var(--surface)}

/* Responsive */
@media(max-width:900px){
  .colleagues-page .teachers-grid{grid-template-columns:1fr 1fr}
  .colleagues-page .filters{flex-wrap:wrap}
  .colleagues-page .filter-group{min-width:calc(50% - 6px)}
  .colleagues-page .prof-facts{grid-template-columns:1fr}
}
@media(max-width:600px){
  .colleagues-page{padding:0}
  .colleagues-page .teachers-grid{grid-template-columns:1fr}
  .colleagues-page .filters{flex-direction:column}
  .colleagues-page .filter-group{min-width:100%}
  .colleagues-page .sort-bar{flex-direction:column;gap:10px;align-items:flex-start}
  .colleagues-page .prof-overlay{padding:0;align-items:flex-end}
  .colleagues-page .prof-modal{border-radius:24px 24px 0 0;max-height:95vh}
  .colleagues-page .prof-top{flex-direction:column;align-items:center;text-align:center}
  .colleagues-page .prof-stats{justify-content:center}
  .colleagues-page .prof-footer{flex-direction:column-reverse}
  .colleagues-page .prof-msg{width:100%;justify-content:center}
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pluralizeColleagues(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "коллега"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return "коллеги"
  return "коллег"
}

function pluralizeYears(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "год"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "года"
  return "лет"
}

function shortSpecs(specs: string[]): string {
  return specs.slice(0, 2).join(", ")
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherColleaguesPage() {
  // Filter UI state (draft — applied только по клику «Найти»).
  const [searchDraft, setSearchDraft] = useState("")
  const [specDraft, setSpecDraft] = useState<SpecKey>("all")
  const [nativeDraft, setNativeDraft] = useState<NativeKey>("any")

  const [applied, setApplied] = useState<{
    search: string
    spec: SpecKey
    native: NativeKey
    sort: SortKey
    onlineOnly: boolean
  }>({
    search: "",
    spec: "all",
    native: "any",
    sort: "rating",
    onlineOnly: false,
  })

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Modal state.
  const [modalTeacher, setModalTeacher] = useState<TeacherDetail | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const listAbortRef = useRef<AbortController | null>(null)
  const detailAbortRef = useRef<AbortController | null>(null)

  // ─── Fetch list ────────────────────────────────────────────────────────────
  const loadTeachers = useCallback(async (params: typeof applied) => {
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
      if (params.native !== "any") q.set("native", params.native)
      // SortKey "experience" — фронт-сортировка (бэк не поддерживает): просим
      // у API rating, дальше сортируем локально.
      const apiSort: "rating" | "reviews" =
        params.sort === "reviews" ? "reviews" : "rating"
      q.set("sort", apiSort)
      q.set("limit", "60")

      const res = await fetch(`/api/teachers?${q.toString()}`, {
        cache: "no-store",
        signal: ac.signal,
      })
      if (!res.ok) {
        if (!ac.signal.aborted)
          toast.error("Не удалось загрузить коллег")
        return
      }
      const data = (await res.json()) as { teachers: Teacher[]; total: number }
      let list = data.teachers ?? []

      // Фронт-фильтр «только онлайн сейчас».
      if (params.onlineOnly) {
        list = list.filter((t) => t.is_online === true)
      }

      // Фронт-сортировка по опыту (если запрошено).
      if (params.sort === "experience") {
        list = [...list].sort(
          (a, b) => (b.experience_years ?? 0) - (a.experience_years ?? 0)
        )
      }

      setTeachers(list)
      setTotal(params.onlineOnly ? list.length : data.total ?? list.length)
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return
      console.error("[colleagues page] load error:", err)
      toast.error("Не удалось загрузить коллег")
    } finally {
      if (!ac.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeachers(applied)
    return () => listAbortRef.current?.abort()
  }, [applied, loadTeachers])

  const handleSearch = useCallback(() => {
    setApplied((prev) => ({
      ...prev,
      search: searchDraft,
      spec: specDraft,
      native: nativeDraft,
    }))
  }, [searchDraft, specDraft, nativeDraft])

  const handleSearchKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSearch()
    },
    [handleSearch]
  )

  const handleSortChange = useCallback((sort: SortKey) => {
    setApplied((prev) => ({ ...prev, sort }))
  }, [])

  const toggleOnlineOnly = useCallback(() => {
    setApplied((prev) => ({ ...prev, onlineOnly: !prev.onlineOnly }))
  }, [])

  // ─── Modal: открыть/закрыть + грузим расширенный профиль ───────────────────
  const openProfile = useCallback(async (teacher: Teacher) => {
    setModalTeacher({
      ...teacher,
      education: null,
      certificates: [],
      video_intro_url: null,
    })
    setModalOpen(true)
    requestAnimationFrame(() => setModalVisible(true))

    detailAbortRef.current?.abort()
    const ac = new AbortController()
    detailAbortRef.current = ac
    setDetailLoading(true)

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
  }, [])

  const closeProfile = useCallback(() => {
    setModalVisible(false)
    detailAbortRef.current?.abort()
    window.setTimeout(() => {
      setModalOpen(false)
      setModalTeacher(null)
    }, 300)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfile()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modalOpen, closeProfile])

  useEffect(() => {
    if (!modalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [modalOpen])

  // ─── Render ────────────────────────────────────────────────────────────────
  const headerCount = total
  const mailtoHref = modalTeacher?.email
    ? `mailto:${modalTeacher.email}?subject=${encodeURIComponent(
        "Raw English — коллега пишет"
      )}`
    : null

  return (
    <div className="colleagues-page">
      <style dangerouslySetInnerHTML={{ __html: COLLEAGUES_CSS }} />

      {/* Header */}
      <div className="page-header">
        <h1>
          Найди своего <span className="gl">colleague</span>
        </h1>
        <p>Коллеги — преподаватели платформы Raw English</p>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group" style={{ flex: 1.5 }}>
          <label className="filter-label" htmlFor="colleagues-search">
            Поиск
          </label>
          <input
            id="colleagues-search"
            className="filter-search"
            type="text"
            placeholder="Имя, специализация..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={handleSearchKey}
            aria-label="Поиск коллеги"
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="colleagues-spec">
            Специализация
          </label>
          <select
            id="colleagues-spec"
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
          <label className="filter-label" htmlFor="colleagues-native">
            Носитель
          </label>
          <select
            id="colleagues-native"
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

      {/* Online-only chip row */}
      <div className="chip-row">
        <button
          type="button"
          className={`chip${applied.onlineOnly ? " active" : ""}`}
          onClick={toggleOnlineOnly}
          aria-pressed={applied.onlineOnly}
        >
          <span className="chip-dot" />
          Только онлайн сейчас
        </button>
      </div>

      {/* Sort bar */}
      <div className="sort-bar">
        <div className="sort-count">
          Найдено: <b>{headerCount}</b> {pluralizeColleagues(headerCount)}
        </div>
        <div className="sort-tabs" role="tablist" aria-label="Сортировка">
          <SortTab
            active={applied.sort === "rating"}
            onClick={() => handleSortChange("rating")}
          >
            По рейтингу
          </SortTab>
          <SortTab
            active={applied.sort === "experience"}
            onClick={() => handleSortChange("experience")}
          >
            По опыту
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
          <span className="empty-emoji">👋</span>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Коллег пока не нашли
          </div>
          <div style={{ fontSize: ".78rem" }}>
            Попробуй изменить фильтры или сбросить поиск.
          </div>
        </div>
      ) : (
        <div className="teachers-grid">
          {teachers.map((t) => (
            <ColleagueCard
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
          aria-label={`Профиль коллеги: ${modalTeacher.full_name}`}
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
                      {modalTeacher.experience_years ?? "—"}
                    </div>
                    <div className="prof-stat-lbl">
                      {modalTeacher.experience_years != null
                        ? pluralizeYears(modalTeacher.experience_years) +
                          " опыта"
                        : "Опыт"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="prof-body">
              {/* Профиль (расширенный) */}
              {detailLoading && !modalTeacher.bio ? (
                <div className="prof-section">
                  <div className="prof-section-title">Профиль</div>
                  <div className="prof-section-loading">Загрузка…</div>
                </div>
              ) : modalTeacher.bio ? (
                <div className="prof-section">
                  <div className="prof-section-title">Профиль</div>
                  <div className="prof-bio">{modalTeacher.bio}</div>
                </div>
              ) : !modalTeacher.experience_years &&
                !modalTeacher.education &&
                modalTeacher.languages.length === 0 &&
                modalTeacher.specializations.length === 0 &&
                modalTeacher.certificates.length === 0 ? (
                <div className="prof-empty">
                  <div className="prof-empty-emoji">📝</div>
                  <b>Профиль ещё не заполнен</b>
                  <span>Коллега пока не добавил информацию о себе.</span>
                </div>
              ) : null}

              {/* Факты: опыт + языки + образование */}
              {(modalTeacher.experience_years != null ||
                modalTeacher.languages.length > 0 ||
                modalTeacher.education) && (
                <div className="prof-section">
                  <div className="prof-section-title">Опыт и образование</div>
                  <div className="prof-facts">
                    {modalTeacher.experience_years != null ? (
                      <div className="prof-fact">
                        <div className="prof-fact-lbl">Опыт</div>
                        <div className="prof-fact-val">
                          {modalTeacher.experience_years}{" "}
                          {pluralizeYears(modalTeacher.experience_years)}
                        </div>
                      </div>
                    ) : null}
                    {modalTeacher.languages.length > 0 ? (
                      <div className="prof-fact">
                        <div className="prof-fact-lbl">Языки</div>
                        <div className="prof-fact-val">
                          {modalTeacher.languages.join(" · ")}
                        </div>
                      </div>
                    ) : null}
                    {modalTeacher.education ? (
                      <div
                        className="prof-fact"
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <div className="prof-fact-lbl">Образование</div>
                        <div className="prof-fact-val">
                          {modalTeacher.education}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Сертификаты */}
              {modalTeacher.certificates.length > 0 ? (
                <div className="prof-section">
                  <div className="prof-section-title">Сертификаты</div>
                  <div className="prof-cert-list">
                    {modalTeacher.certificates.map((c, i) => (
                      <div key={`${c}-${i}`} className="prof-cert">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Специализации тегами */}
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

function ColleagueCard({
  teacher,
  onOpen,
}: {
  teacher: Teacher
  onOpen: () => void
}) {
  const specLabel = shortSpecs(teacher.specializations).toUpperCase()
  const tags = teacher.specializations.slice(0, 3)
  const hasEmail = Boolean(teacher.email)
  const expLabel =
    teacher.experience_years != null
      ? `${teacher.experience_years} ${pluralizeYears(teacher.experience_years)}`
      : null

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
      aria-label={`Открыть профиль коллеги: ${teacher.full_name}`}
    >
      <div className="t-photo">
        {teacher.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={teacher.avatar_url} alt={teacher.full_name} />
        ) : (
          <div className="t-photo-placeholder">{teacher.initials || "?"}</div>
        )}
        {teacher.is_native ? (
          <div className="t-native-badge">Native</div>
        ) : null}
        {teacher.is_online ? (
          <div className="t-online">
            <div className="t-online-dot" />
            Онлайн
          </div>
        ) : null}
      </div>
      <div className="t-body">
        <div className="t-name">{teacher.full_name}</div>
        <div className="t-spec">{specLabel || "КОЛЛЕГА ПО ПЛАТФОРМЕ"}</div>
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
          {expLabel ? (
            <div className="t-exp">
              <b>{expLabel}</b> опыта
            </div>
          ) : null}
        </div>
        <div className="t-actions">
          <button
            type="button"
            className="t-btn t-btn--ghost"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          >
            Открыть профиль
          </button>
        </div>
      </div>
    </div>
  )
}
