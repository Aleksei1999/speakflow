"use client"

import "@/styles/dashboard/student-teachers.css"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { useUser } from "@/hooks/use-user"

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
  // Если страница рендерится под админом (re-export в /admin/teachers) —
  // прячем booking/review UI. Триггерим readOnly только когда роль
  // ОТВЕРЖДЕНА не-студент (admin/teacher). Пока loading или role=null
  // (transient profile-fetch error) — оставляем student-режим, иначе
  // студент с RLS-hiccup'ом залипал в «Подробнее» вечно.
  const { role, isLoading: userLoading } = useUser()
  const readOnly = !userLoading && role !== null && role !== "student"

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
  // Форма «Оставить отзыв»
  const [reviewFormOpen, setReviewFormOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState<number>(5)
  const [reviewComment, setReviewComment] = useState<string>("")
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
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
      setReviewFormOpen(false)
      setReviewRating(5)
      setReviewComment("")
    }, 300)
  }, [])

  const submitReview = useCallback(async () => {
    if (!modalTeacher || reviewSubmitting) return
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Поставь оценку от 1 до 5")
      return
    }
    setReviewSubmitting(true)
    try {
      const res = await fetch(`/api/teachers/${modalTeacher.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || "Не удалось отправить отзыв")
        setReviewSubmitting(false)
        return
      }
      toast.success("Спасибо за отзыв!")
      setReviewFormOpen(false)
      setReviewRating(5)
      setReviewComment("")
      // Перезагрузим список отзывов
      const r = await fetch(`/api/teachers/${modalTeacher.id}/reviews?limit=10`, { cache: "no-store" })
      if (r.ok) {
        const data = (await r.json()) as { reviews: Review[] }
        setReviews(data.reviews ?? [])
      }
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setReviewSubmitting(false)
    }
  }, [modalTeacher, reviewRating, reviewComment, reviewSubmitting])

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
  // Supabase PostgREST count='exact' игнорирует фильтр по joined-таблице
  // (profiles.full_name ILIKE %…%), поэтому при поиске "Andrei" total
  // возвращался = 3, хотя реально нашли 1. При активном поиске показываем
  // длину отфильтрованного массива.
  const headerCount = applied.search.trim() ? teachers.length : total

  const bookBtnLabel = useMemo(() => {
    if (bookingSuccess) return "Записано!"
    if (booking) return "…"
    if (selectedSlot) return `Записаться на ${selectedSlot.time_label}`
    return "Записаться на урок"
  }, [bookingSuccess, booking, selectedSlot])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="teachers-page">
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
        {/* HIGH-5 (audit 2026-05-13): пока Yookassa отключена и в карточках
            показывается «Бесплатно», фильтр цен скрываем — он бессмысленный
            и сбивает с толку. Вернуть при включении платных уроков. */}
        {false && (
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
        )}
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
          {teachers.map((t, i) => (
            <TeacherCard
              key={t.id}
              teacher={t}
              onOpen={() => openProfile(t)}
              readOnly={readOnly}
              eager={i < 6}
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
                  <Image
                    src={modalTeacher.avatar_url}
                    alt={modalTeacher.full_name}
                    width={100}
                    height={100}
                    sizes="100px"
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 22 }}
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

              {modalTeacher.languages.length > 0 ? (
                <div className="prof-section">
                  <div className="prof-section-title">Языки</div>
                  <div className="prof-tags">
                    {modalTeacher.languages.map((l) => (
                      <span key={l} className="prof-tag">
                        {l.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {modalTeacher.education ? (
                <div className="prof-section">
                  <div className="prof-section-title">Образование</div>
                  <div className="prof-bio">{modalTeacher.education}</div>
                </div>
              ) : null}

              {modalTeacher.certificates.length > 0 ? (
                <div className="prof-section">
                  <div className="prof-section-title">Сертификаты</div>
                  <div className="prof-tags">
                    {modalTeacher.certificates.map((c) => (
                      <span key={c} className="prof-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {modalTeacher.video_intro_url ? (
                <div className="prof-section">
                  <div className="prof-section-title">Видео-визитка</div>
                  <a
                    href={modalTeacher.video_intro_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="prof-video-link"
                  >
                    Посмотреть видео
                    <span aria-hidden style={{ marginLeft: 6 }}>↗</span>
                  </a>
                </div>
              ) : null}

              {!readOnly && (
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
              )}

              <div className="prof-section">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 10,
                  }}
                >
                  <div className="prof-section-title" style={{ marginBottom: 0 }}>
                    Отзывы учеников
                  </div>
                  {!reviewFormOpen && !readOnly && (
                    <button
                      type="button"
                      onClick={() => setReviewFormOpen(true)}
                      style={{
                        background: "var(--red, #B63F37)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        padding: "7px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 2px 0 rgba(180,30,45,.3)",
                      }}
                    >
                      Оставить отзыв
                    </button>
                  )}
                </div>

                {reviewFormOpen && (
                  <div
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                        Оценка
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setReviewRating(n)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: n <= reviewRating ? "#FBBF24" : "var(--surface)",
                              color: n <= reviewRating ? "#fff" : "var(--muted)",
                              fontSize: 18,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                            aria-label={`${n} из 5`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      maxLength={1000}
                      placeholder="Расскажи как прошёл урок (необязательно)"
                      rows={3}
                      style={{
                        width: "100%",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "var(--text)",
                        fontFamily: "inherit",
                        resize: "vertical",
                        marginBottom: 10,
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewFormOpen(false)
                          setReviewComment("")
                          setReviewRating(5)
                        }}
                        disabled={reviewSubmitting}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                          borderRadius: 10,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={submitReview}
                        disabled={reviewSubmitting}
                        style={{
                          background: "var(--red, #B63F37)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 10,
                          padding: "8px 16px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 2px 0 rgba(180,30,45,.3)",
                          fontFamily: "inherit",
                          opacity: reviewSubmitting ? 0.6 : 1,
                        }}
                      >
                        {reviewSubmitting ? "Отправляем…" : "Отправить"}
                      </button>
                    </div>
                  </div>
                )}

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
                              <Image
                                src={r.student.avatar_url}
                                alt={r.student.full_name}
                                width={28}
                                height={28}
                                sizes="28px"
                                loading="lazy"
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
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

            {!readOnly && (
              <div className="prof-footer">
                {/* TEMP: disabled until Yookassa integration is live — a2a0600 */}
                {/* <div className="prof-price">
                  <b>{formatRub(modalTeacher.hourly_rate_rub)}</b> / 60 мин
                </div> */}
                <div className="prof-price">
                  <b>Пробный урок</b> · 0 ₽
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
            )}
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
  readOnly,
  eager,
}: {
  teacher: Teacher
  onOpen: () => void
  readOnly?: boolean
  eager?: boolean
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
          <Image
            src={teacher.avatar_url}
            alt={teacher.full_name}
            fill
            // 3 колонки до 900px (33vw), 2 — до 600px (50vw), 1 — на мобиле.
            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 360px"
            // first-fold cards грузим eagerly (LCP candidate), остальное — lazy.
            {...(eager ? { priority: true } : { loading: "lazy" })}
            style={{ objectFit: "cover" }}
          />
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
          {/* TEMP: disabled until Yookassa integration is live — a2a0600 */}
          {/* <div className="t-price">
            <b>{formatRub(teacher.hourly_rate_rub)}</b> / 60 мин
          </div> */}
          <div className="t-price">
            <b>Пробный</b> · 0 ₽
          </div>
        </div>
        {!readOnly && (
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
        )}
        {readOnly && (
          <button
            type="button"
            className="t-book-btn t-book-btn--readonly"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          >
            Подробнее
          </button>
        )}
      </div>
    </div>
  )
}
