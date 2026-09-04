import { ArrowIcon } from "@/components/icons/ArrowIcon"

// Строка «входящей заявки ученика» — Figma «Администратор/Учитель RAW English».
// Лаймовая плашка + тег теста + тёмная «шапка» справа + уровень + круглая
// стрелка ← (Ø71, белая обводка), сидящая серединой на границе.
//
// Используется на teacher- и admin-дашбордах. Для развёрнутого состояния
// (карточка с вопросами теста) — см. TeacherRawDashboard, компонент
// рендерит только СВЁРНУТУЮ версию.
//
// Стили — public/dashboard/shared-pills.css (класс .app-row).

interface ApplicationRowProps {
  name: string
  /** Уровень: "A1", "B2", … — уже отформатированная строка. */
  level: string
  /** true = «тест пройден», false = «тест не пройден». */
  testPassed: boolean
  onOpen?: () => void
  /** Дополнительный атрибут aria-label (по умолчанию `Открыть заявку {name}`). */
  ariaLabel?: string
}

export function ApplicationRow({ name, level, testPassed, onOpen, ariaLabel }: ApplicationRowProps) {
  return (
    <div className="app-row">
      <span className="app-row-name">{name}</span>
      <span className={`app-row-tag ${testPassed ? "app-row-tag--ok" : "app-row-tag--no"}`}>
        {testPassed ? "тест пройден" : "тест не пройден"}
      </span>
      <div className="app-row-cap" aria-hidden />
      <span className="app-row-lvl">{level}</span>
      <button
        type="button"
        className="app-row-arrow"
        aria-label={ariaLabel ?? `Открыть заявку ${name}`}
        onClick={onOpen}
      >
        <ArrowIcon direction="left" size={32} style={{ color: "#1E1E1E" }} />
      </button>
    </div>
  )
}
