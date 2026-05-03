export const SITE_NAME = 'Raw English'
export const BRAND_NAME = 'Raw English'
export const SITE_DESCRIPTION = 'Современная EdTech-платформа для изучения английского языка'

export const ROLES = { STUDENT: 'student', TEACHER: 'teacher', ADMIN: 'admin' } as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

export const LESSON_STATUSES = {
  PENDING_PAYMENT: 'pending_payment', BOOKED: 'booked', IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed', CANCELLED: 'cancelled', NO_SHOW: 'no_show',
} as const

export const PAYMENT_STATUSES = {
  PENDING: 'pending', WAITING_FOR_CAPTURE: 'waiting_for_capture',
  SUCCEEDED: 'succeeded', CANCELLED: 'cancelled', REFUNDED: 'refunded',
} as const

export const ENGLISH_LEVELS = ['Raw', 'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done'] as const
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number]

export const XP_REWARDS = {
  COMPLETE_LESSON: 100, LEAVE_REVIEW: 20, COMPLETE_LEVEL_TEST: 50,
  STREAK_7: 200, STREAK_30: 500,
} as const

export const LEVEL_THRESHOLDS = [0, 300, 800, 1500, 3000, 5000, 8000, 12000, 18000, 25000]
export const DEFAULT_LESSON_DURATION = 50

/**
 * Окно доступа к комнате урока.
 *   openAt  = scheduled_at - LESSON_JOIN_WINDOW мин
 *   closeAt = scheduled_at + duration_minutes + LESSON_POST_WINDOW мин
 * Оба лимита проверяются на сервере (API /api/jitsi/token + SSR страницы урока).
 */
export const LESSON_JOIN_WINDOW = 5
export const LESSON_POST_WINDOW = 5
