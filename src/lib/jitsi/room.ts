// ---------------------------------------------------------------
// Jitsi room-name resolver.
//
// Используется И на сервере SSR (student/teacher lesson pages),
// И в /api/jitsi/token, чтобы имя комнаты, на которое выпущен JWT,
// СОВПАДАЛО с именем, в которое монтируется iframe.
//
// Раньше SSR падал на красивый префикс `raw-english-${id.slice(0,8)}`,
// а JWT подписывал полный UUID — prosody резал клиента: room mismatch.
// Никаких "красивых" имён: prosody не парсит, JWT подписывает строку 1:1.
//
// Договор: если lesson.jitsi_room_name проставлен — берём его (trim).
// Иначе fallback = lesson.id (UUID). НЕ slice'им — JWT signs полный.
// ---------------------------------------------------------------

export function getJitsiRoomName(
  lesson: { id: string; jitsi_room_name?: string | null }
): string {
  const explicit = lesson.jitsi_room_name?.trim()
  return explicit && explicit.length > 0 ? explicit : lesson.id
}
