"use client"

// ---------------------------------------------------------------
// LiveLessonCTA — клиентский countdown-CTA для строк урока на
// student/teacher dashboard и Speaking Club room-карточек.
//
// Зачем: до этого расчёт access.status (waiting/live/expired) шёл
// SSR-side в (dashboard)/student|teacher/page.tsx, и страницы стояли
// на `force-dynamic`, потому что secondsLeft до openAt должен идти
// в реальном времени. С этим компонентом UI пересчитывается на
// клиенте раз в 5 сек, и страницу-родитель можно (постепенно)
// переводить с force-dynamic на revalidate=30/60.
//
// CSS-классы идут как props (`classPrefix` + модификаторы) — чтобы
// один компонент работал и для .stu-today-join (студент), и для
// .tch-today-join (преподаватель/клуб), сохраняя scoped CSS,
// которое уже описано в дашборд-страницах.
// ---------------------------------------------------------------

import { useState, useEffect } from "react"
import Link from "next/link"
import { computeLessonAccess } from "@/lib/lesson-access"

/**
 * SOON-окно = 10 мин до openAt — в эти пределы CTA из «ожидается»
 * превращается в «Скоро откроется (через N мин)». Совпадает с тем,
 * что было заинлайнено в student/teacher page.tsx (`secondsUntilOpen <= 600`).
 */
const SOON_WINDOW_SEC = 600

/**
 * Tick interval — 30 сек. Countdown показывается в минутах
 * («через 3 мин»), 30 сек достаточно для smooth обновления.
 * 5 сек давало 5+ независимых tick'ов в секунду на странице с
 * множеством строк — визуально «страница обновляется сама».
 */
const TICK_MS = 30000

export type LiveLessonCTARole = "student" | "teacher"

export interface LiveLessonCTAProps {
  /** UUID урока — для href `/{role}/lesson/{id}` либо `/club/{id}/room`. */
  lessonId: string
  /** ISO-строка scheduled_at (UTC). */
  scheduledAt: string
  /** Длительность урока в минутах (для расчёта closeAt). */
  durationMinutes: number
  /**
   * Какой роутинг строить:
   *   - "student" / "teacher" → /{role}/lesson/{id}
   *   - "club" → /club/{id}/room
   */
  role: LiveLessonCTARole | "club"
  /**
   * Текущий бизнес-статус урока (lessons.status):
   * completed | cancelled | no_show | in_progress | booked | …
   * Нужен, чтобы вырубить CTA для уже завершённых / отменённых уроков
   * даже если now ещё в окне доступа.
   */
  lessonStatus?: string | null
  /**
   * Префикс CSS-класса CTA. На student page это `stu-today-join`,
   * на teacher page — `tch-today-join`. Модификаторы добавляются как
   * `{prefix}--live`, `{prefix}--waiting`, и т.д.
   */
  classPrefix: string
  /** Подсказка под кнопкой waiting (`{prefix}-hint`). */
  hintClassName?: string
  /** Текст, который показать в state=live (по умолчанию «Начать»). */
  liveLabel?: string
  /** Текст для in_progress (lesson.status === "in_progress" и доступ live). */
  inProgressLabel?: string
  /**
   * Что показать в state=ожидается (но не в SOON_WINDOW_SEC). По умолчанию
   * `null` — компонент рендерит null (страница может показать своё, например,
   * `<span className="status status-pending">ожидается</span>`).
   *
   * Если задан — рендерим как disabled span с классом `{prefix}--waiting`
   * (без countdown'a — countdown даёт только SOON-window).
   */
  notStartedFallback?: React.ReactNode
}

/**
 * Рендерит CTA-кнопку (или disabled span) в зависимости от
 * computeLessonAccess + lesson.status.
 *
 * Стейты:
 *   - completed                  → null (используй sch-status--done на родительской странице)
 *   - cancelled                  → disabled span `{prefix}--cancelled` «Отменён»
 *   - no_show                    → disabled span `{prefix}--missed` «Пропущен»
 *   - live + in_progress         → disabled span `{prefix}--live` «● Идёт сейчас»
 *   - live                       → <Link> `{prefix}` «Начать»
 *   - waiting (<= 10 мин)        → disabled span `{prefix}--waiting` «Скоро откроется» + hint «через N мин»
 *   - waiting (> 10 мин)         → notStartedFallback (либо null)
 *   - expired                    → disabled span `{prefix}--expired` «Урок завершён»
 *
 * Replica of inline-логики из (dashboard)/{student,teacher}/page.tsx.
 */
export function LiveLessonCTA({
  lessonId,
  scheduledAt,
  durationMinutes,
  role,
  lessonStatus,
  classPrefix,
  hintClassName,
  liveLabel = "Начать",
  inProgressLabel = "● Идёт сейчас",
  notStartedFallback = null,
}: LiveLessonCTAProps): React.ReactNode {
  // Hydration-safe init: на SSR и initial client render используем
  // 0 → computeLessonAccess отдаёт стабильный «нет CTA». После mount
  // useEffect выставляет реальный Date.now() и запускает tick.
  // Так избегаем React #418 (text mismatch) когда server-render и
  // client-hydrate попадают на boundary live↔waiting↔expired.
  const [now, setNow] = useState<number>(0)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // До mount — рендерим notStartedFallback. Server и client дадут
  // одинаковую разметку (фоллбэк null или span), hydration пройдёт чисто.
  if (now === 0) {
    return notStartedFallback as React.ReactNode
  }

  // Полностью завершённые уроки CTA не показывает — родительская строка
  // отрисует свой «✓ завершён» лейбл.
  if (lessonStatus === "completed") return null

  const access = computeLessonAccess({
    scheduledAt,
    durationMinutes,
    status: lessonStatus ?? undefined,
    now,
  })

  const cancelledClass = `${classPrefix} ${classPrefix}--cancelled`
  const missedClass = `${classPrefix} ${classPrefix}--missed`
  const expiredClass = `${classPrefix} ${classPrefix}--expired`
  const waitingClass = `${classPrefix} ${classPrefix}--waiting`
  const liveClass = `${classPrefix} ${classPrefix}--live`
  const baseClass = classPrefix

  if (lessonStatus === "no_show" || access.status === "no_show") {
    return <span className={missedClass}>Пропущен</span>
  }
  if (lessonStatus === "cancelled" || access.status === "cancelled") {
    return <span className={cancelledClass}>Отменён</span>
  }

  const isLive =
    access.status === "live" &&
    lessonStatus !== "completed" &&
    lessonStatus !== "cancelled" &&
    lessonStatus !== "no_show"

  if (isLive && lessonStatus === "in_progress") {
    return <span className={liveClass}>{inProgressLabel}</span>
  }

  if (isLive) {
    const href =
      role === "club" ? `/club/${lessonId}/room` : `/${role}/lesson/${lessonId}`
    return (
      <Link href={href} className={baseClass}>
        {liveLabel}
      </Link>
    )
  }

  const secondsUntilOpen = Math.max(
    0,
    Math.floor((access.openAtMs - access.nowMs) / 1000),
  )
  const minutesUntilOpen = Math.ceil(secondsUntilOpen / 60)
  const isSoon = access.status === "waiting" && secondsUntilOpen <= SOON_WINDOW_SEC

  if (isSoon) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        <span className={waitingClass}>Скоро откроется</span>
        {hintClassName ? (
          <span className={hintClassName}>через {minutesUntilOpen} мин</span>
        ) : null}
      </div>
    )
  }

  if (access.status === "expired") {
    return <span className={expiredClass}>Урок завершён</span>
  }

  return <>{notStartedFallback}</>
}
