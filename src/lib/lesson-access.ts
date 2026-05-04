/**
 * Окно доступа к комнате урока.
 *
 *   openAt  = scheduled_at - LESSON_JOIN_WINDOW мин (вход открывается за 5 мин до старта)
 *   closeAt = scheduled_at + duration_minutes + LESSON_POST_WINDOW мин (закрывается через 5 мин после конца)
 *
 * Все сравнения — в UTC millis. Таймзоны не трогаем (scheduled_at уже UTC).
 * Используется и на сервере (/api/jitsi/token, SSR страницы урока), и на клиенте (countdown).
 */
import { LESSON_JOIN_WINDOW, LESSON_POST_WINDOW } from "@/lib/constants"

export type LessonAccessStatus =
  | "waiting"    // слишком рано — показать обратный отсчёт
  | "live"       // окно открыто — пускаем в комнату
  | "expired"    // слишком поздно — урок закончился
  | "cancelled"  // статус урока = cancelled — блокируем
  | "no_show"    // статус урока = no_show — пропущен (визуально отдельно от cancelled)

export interface LessonAccessInput {
  scheduledAt: string | Date | number
  durationMinutes: number
  status?: string | null
  now?: number
}

export interface LessonAccessWindow {
  status: LessonAccessStatus
  openAtMs: number
  closeAtMs: number
  scheduledMs: number
  nowMs: number
}

export function computeLessonAccess({
  scheduledAt,
  durationMinutes,
  status,
  now,
}: LessonAccessInput): LessonAccessWindow {
  const scheduledMs =
    scheduledAt instanceof Date
      ? scheduledAt.getTime()
      : typeof scheduledAt === "number"
        ? scheduledAt
        : new Date(scheduledAt).getTime()

  const openAtMs = scheduledMs - LESSON_JOIN_WINDOW * 60 * 1000
  const closeAtMs = scheduledMs + durationMinutes * 60 * 1000 + LESSON_POST_WINDOW * 60 * 1000
  const nowMs = typeof now === "number" ? now : Date.now()

  let accessStatus: LessonAccessStatus
  if (status === "cancelled") {
    accessStatus = "cancelled"
  } else if (status === "no_show") {
    accessStatus = "no_show"
  } else if (nowMs < openAtMs) {
    accessStatus = "waiting"
  } else if (nowMs > closeAtMs) {
    accessStatus = "expired"
  } else {
    accessStatus = "live"
  }

  return { status: accessStatus, openAtMs, closeAtMs, scheduledMs, nowMs }
}
