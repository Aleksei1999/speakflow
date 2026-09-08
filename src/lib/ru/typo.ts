// Русская типографика: короткие предлоги/союзы/местоимения не оставляем в конце строки —
// приклеиваем к следующему слову неразрывным пробелом. Правило заказчика для всех текстов
// в интерфейсе (карточки, модалки, лендинг). Идемпотентно: повторный вызов ничего не меняет.
const NBSP_WORDS =
  /(^|[\s(«"„])(в|во|с|со|и|а|но|на|не|ни|к|ко|о|об|от|до|за|из|по|под|при|у|же|бы|ли|для|как|что|кто|те|вы|мы|я|это|или|без|над|про|ещё|уже|так|там|тут)\s+/gi

export function nb(s: string): string
export function nb(s: string | null | undefined): string | null | undefined
export function nb(s: string | null | undefined) {
  if (!s) return s
  return s.replace(NBSP_WORDS, (_m, pre: string, w: string) => `${pre}${w}\u00A0`)
}
