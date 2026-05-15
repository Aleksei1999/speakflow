"use client"

import "@/styles/dashboard/teacher-teachers.css"

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
