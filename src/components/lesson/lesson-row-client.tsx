"use client"

// ---------------------------------------------------------------
// LessonRowClient — один client-row для student и teacher dashboard.
//
// Зачем существует: до этого вся строка урока (wrapper-тег <Link>/<div>,
// .active-подсветка, и CTA-кнопка) собиралась на сервере через
// computeLessonAccess(now=new Date()), из-за чего student/teacher
// page.tsx стояли на `force-dynamic`. Теперь:
//   • SSR/static-render отдаёт layout страницы вместе с *данными* урока
//     (id, scheduled_at, имя препода/студента и т.д.) — это всё не
//     time-dependent и cache-able.
//   • Эта компонента-row подхватывает на клиенте Date.now() через
//     setInterval(5000) и сама решает: показать <Link> и .active, или
//     <div>, какой CTA пихнуть в правую часть. Re-render тикает только
//     этот узел, страница-родитель идёт под revalidate=30.
//
// CSS-классы (`.stu-today`, `.tch-schedule-item`, `.stu-today-join`,
// `.tch-today-join`, `.sch-link`, `.schedule-link`) живут в scoped
// стилях родителей (.stu-home / .tch-home) — компонент сам их не
// дублирует, только применяет.
//
// Внутри CTA используем существующий <LiveLessonCTA> — он уже умеет
// live/waiting/expired/cancelled/no_show + countdown.
// ---------------------------------------------------------------

import { useState, useEffect } from "react"
import Link from "next/link"
import { computeLessonAccess } from "@/lib/lesson-access"
import { LiveLessonCTA } from "./live-lesson-cta"
import { formatLessonTime } from "@/lib/time"

// 30s tick — countdown в минутах, smooth достаточно. 5s давало
// «страница обновляется сама» на /teacher с множеством строк.
const TICK_MS = 30000
const SOON_WINDOW_SEC = 600

export type LessonRowRole = "student" | "teacher"

export interface LessonRowClientProps {
  /** UUID урока — нужен для `/{role}/lesson/{id}` href. */
  lessonId: string
  /** ISO scheduled_at в UTC. */
  scheduledAt: string
  /** Длительность урока (минуты). */
  durationMinutes: number
  /** lessons.status (booked / in_progress / completed / cancelled / no_show / pending_payment). */
  status: string
  /** Чья сторона смотрит — определяет href и UI-варианты. */
  role: LessonRowRole
  /** Имя контрагента — рисуется в .info → <p>. */
  counterpartName?: string | null
  /** Только для student — флаг «🎯 Пробный урок» (нужен для заголовка). */
  isTrial?: boolean
  /**
   * Префикс CSS-класса CTA. На student page это `stu-today-join`,
   * на teacher — `tch-today-join`. Передаём как prop, чтобы не привязываться
   * к роли (на будущее: например, admin-предпросмотр).
   */
  classPrefix: "stu-today-join" | "tch-today-join"
  /** Базовый класс строки — `sch-item` (student) или `schedule-item` (teacher). */
  rowClassName: string
  /** Класс-обёртка <Link> для clickable-режима — `sch-link` / `schedule-link`. */
  linkClassName: string
  /** Класс для подсказки countdown — `stu-today-hint` / `tch-today-hint`. */
  hintClassName: string
}

/**
 * Единая строка с CTA. Слева — time-box, в центре — заголовок/имя,
 * справа — CTA / status-pill. Внешняя обёртка — <Link>, если урок
 * можно «открыть» (live или soon), иначе обычный <div>.
 *
 * Hydration: SSR отдаёт исходный layout с now=время-рендера на сервере.
 * На клиенте первый tick (через 5 сек) подменит now на реальный
 * Date.now() — если статус успел перейти live → expired (или waiting →
 * live), компонент перерисуется. Расхождения в первом render minor —
 * это только нижняя часть строки (CTA), верстка стабильная.
 */
export function LessonRowClient({
  lessonId,
  scheduledAt,
  durationMinutes,
  status,
  role,
  counterpartName,
  isTrial = false,
  classPrefix,
  rowClassName,
  linkClassName,
  hintClassName,
}: LessonRowClientProps): React.ReactNode {
  // SSR-safe init: до hydration используем Date.now() прямо в initializer.
  // Если на момент SSR (например, ISR build-time) и client-side render
  // разойдутся — first tick через 5 сек выровняет.
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const dt = new Date(scheduledAt)
  const access = computeLessonAccess({
    scheduledAt,
    durationMinutes,
    status,
    now,
  })
  const secondsUntilOpen = Math.max(
    0,
    Math.floor((access.openAtMs - access.nowMs) / 1000),
  )
  const isLive =
    access.status === "live" &&
    status !== "completed" &&
    status !== "cancelled" &&
    status !== "no_show"
  const isSoon =
    access.status === "waiting" &&
    secondsUntilOpen <= SOON_WINDOW_SEC &&
    status !== "cancelled" &&
    status !== "no_show"

  // Решаем, что показать в правом углу.
  //  • completed → статичный «✓ завершён»
  //  • live / soon / expired / cancelled / no_show → <LiveLessonCTA>
  //  • дефолт «будет позже, > 10 мин до openAt» → status-pill «ожидается»
  //    (на student — это formatLessonTime, на teacher — текст «ожидается»;
  //     визуально одно и то же — серый pill справа).
  let cta: React.ReactNode
  const doneClass =
    role === "student"
      ? "sch-status sch-status--done"
      : "status status-success"
  const pendingClass =
    role === "student"
      ? "sch-status sch-status--pending"
      : "status status-pending"

  if (status === "completed") {
    cta = <span className={doneClass}>✓ завершён</span>
  } else if (
    status === "no_show" ||
    access.status === "no_show" ||
    status === "cancelled" ||
    access.status === "cancelled" ||
    isLive ||
    isSoon ||
    access.status === "expired"
  ) {
    cta = (
      <LiveLessonCTA
        lessonId={lessonId}
        scheduledAt={scheduledAt}
        durationMinutes={durationMinutes}
        role={role}
        lessonStatus={status}
        classPrefix={classPrefix}
        hintClassName={hintClassName}
        liveLabel="Начать"
      />
    )
  } else {
    // «ожидается» / «время начала» — серый, не кликабельный.
    cta = (
      <span className={pendingClass} suppressHydrationWarning>
        {role === "student" ? formatLessonTime(dt) : "ожидается"}
      </span>
    )
  }

  // Структура строки: time-box + info + CTA. CSS-классы отличаются между
  // student и teacher (см. styles в page.tsx), поэтому маркаплейс именования:
  //   • student: .sch-time/.sch-info → `.t`/`.d`/`h4`/`p`
  //   • teacher: .schedule-time/.schedule-info → `.time`/`.dur`/`h4`/`p`
  const timeBoxClass = role === "student" ? "sch-time" : "schedule-time"
  const timeTextClass = role === "student" ? "t" : "time"
  const durTextClass = role === "student" ? "d" : "dur"
  const infoClass = role === "student" ? "sch-info" : "schedule-info"

  const headerText = role === "student"
    ? (isTrial ? "🎯 Пробный урок" : "Урок 1-on-1")
    : (counterpartName ?? "Ученик")
  const subText = role === "student"
    ? `${counterpartName ? `с ${counterpartName}` : "Преподаватель назначен"}${isTrial ? " · бесплатно" : ""}`
    : (isTrial ? "Пробный урок · бесплатно" : "Урок английского")

  const isActive = isLive
  const clickable = isLive || isSoon
  const lessonHref = `/${role}/lesson/${lessonId}`
  const rowClass = `${rowClassName}${isActive ? " active" : ""}`

  const rowInner = (
    <>
      <div className={timeBoxClass}>
        <div className={timeTextClass}>{formatLessonTime(dt)}</div>
        <div className={durTextClass}>{durationMinutes} мин</div>
      </div>
      <div className={infoClass}>
        <h4>
          {role === "teacher" && isTrial ? (
            <>
              {headerText}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: 8,
                  background: "rgba(230,57,70,.10)",
                  color: "var(--red)",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 100,
                  letterSpacing: ".3px",
                  textTransform: "uppercase",
                  border: "1px solid rgba(230,57,70,.2)",
                  verticalAlign: "middle",
                }}
              >
                🎯 Пробный
              </span>
            </>
          ) : (
            headerText
          )}
        </h4>
        <p>{subText}</p>
      </div>
      {cta}
    </>
  )

  return clickable ? (
    <Link
      href={lessonHref}
      className={`${linkClassName} ${rowClass}`}
      style={role === "student" ? { display: "flex", alignItems: "center", gap: 12 } : undefined}
    >
      {rowInner}
    </Link>
  ) : (
    <div className={rowClass}>{rowInner}</div>
  )
}
