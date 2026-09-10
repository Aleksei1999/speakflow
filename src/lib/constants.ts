/**
 * Окно доступа к комнате урока.
 *   openAt  = scheduled_at - LESSON_JOIN_WINDOW мин
 *   closeAt = scheduled_at + duration_minutes + LESSON_POST_WINDOW мин
 * Оба лимита проверяются на сервере (API /api/livekit/token + SSR страницы урока).
 */
export const LESSON_JOIN_WINDOW = 5
export const LESSON_POST_WINDOW = 5
