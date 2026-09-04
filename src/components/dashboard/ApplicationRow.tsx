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
        <svg
          viewBox="0 0 37 37"
          width="32"
          height="32"
          fill="none"
          aria-hidden
          style={{ transform: "scaleX(-1)" }}
        >
          <path
            d="M2.5 15.9099C1.11929 15.9099 0 17.0292 0 18.4099C0 19.7906 1.11929 20.9099 2.5 20.9099V18.4099V15.9099ZM36.2678 20.1777C37.2441 19.2014 37.2441 17.6184 36.2678 16.6421L20.3579 0.732233C19.3816 -0.244078 17.7986 -0.244078 16.8223 0.732233C15.846 1.70854 15.846 3.29146 16.8223 4.26777L30.9645 18.4099L16.8223 32.552C15.846 33.5283 15.846 35.1113 16.8223 36.0876C17.7986 37.0639 19.3816 37.0639 20.3579 36.0876L36.2678 20.1777ZM2.5 18.4099V20.9099H34.5V18.4099V15.9099H2.5V18.4099Z"
            fill="#1E1E1E"
          />
        </svg>
      </button>
    </div>
  )
}
