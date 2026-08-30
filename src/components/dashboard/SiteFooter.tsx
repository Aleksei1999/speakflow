import Link from "next/link"

/**
 * Общий подвал для дашбордов (teacher/student и др.).
 * Стили — в /public/dashboard/site-footer.css (self-scoped .sf-*).
 * Кнопка «Написать в поддержку» — 261×48, Figma-spec Inter 700 20px.
 */
export default function SiteFooter({ supportHref = "/support" }: { supportHref?: string }) {
  return (
    <footer className="sf-footer">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/site-footer.css?v=20260823-1" />

      <div className="sf-footer-links">
        <a href="https://t.me/" target="_blank" rel="noreferrer">Telegram</a>
        <a className="sf-mut" href="#">Связаться</a>
        <Link className="sf-mut" href="/oferta">Договор-оферта</Link>
        <Link className="sf-mut" href="/privacy">Политика конфиденциальности</Link>
      </div>

      <div className="sf-footer-center">
        <Link href={supportHref} className="sf-footer-support">Написать в поддержку</Link>
        <p className="sf-footer-copy">By V. Kratkovskaya © 2026</p>
      </div>

      <div className="sf-footer-legal">
        <span><b>ИП Кратковская</b></span>
        <span>Валерия Витальевна</span>
        <span>ОГРНИП: 325619600134369</span>
        <span>ИНН: 616485783606</span>
      </div>
    </footer>
  )
}
