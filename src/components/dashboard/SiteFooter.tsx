import Link from "next/link"

/**
 * Общий подвал для дашбордов (teacher/student/admin).
 * Стили — в /public/dashboard/site-footer.css, разметка синхронизирована
 * с подвалом главной страницы (.raw2-footer): 4 ссылки слева, кнопка + копирайт
 * по центру, реквизиты справа.
 */

interface Props {
  supportHref?: string
  onSupportClick?: () => void
  /** teacher — Figma 4033:232: та же раскладка, но фрейм 266 (контент с 52), а не 330 (с 101) */
  variant?: "default" | "teacher" | "admin"
}
export default function SiteFooter({ supportHref, onSupportClick, variant = "default" }: Props) {
  return (
    <footer className={`sf-footer${variant === "teacher" ? " sf-footer--teacher" : variant === "admin" ? " sf-footer--admin" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/site-footer.css?v=20260909-admin2" />

      <div className="sf-inner">
        <div className="sf-col sf-col-links">
          <a href="https://t.me/valeriakrat" target="_blank" rel="noreferrer" className="sf-tg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/raw2/ic-telegram.svg" alt="" aria-hidden />Telegram
          </a>
          <Link className="sf-mut" href="/#contact">Связаться</Link>
          <Link className="sf-mut" href="/oferta">Договор-оферта</Link>
          <Link className="sf-mut" href="/privacy">Политика конфиденциальности</Link>
        </div>

        <div className="sf-col sf-col-center">
          {onSupportClick ? (
            <button type="button" className="sf-support" onClick={onSupportClick}>
              Написать в поддержку
            </button>
          ) : supportHref ? (
            <Link href={supportHref} className="sf-support">Написать в поддержку</Link>
          ) : null}
          <p className="sf-copy">By V. Kratkovskaya © 2026</p>
        </div>

        <div className="sf-col sf-legal">
          <span>ИП Кратковская</span>
          <span>Валерия Витальевна</span>
          <span>ОГРНИП: 325619600134369</span>
          <span>ИНН: 616485783606</span>
        </div>
      </div>
    </footer>
  )
}
