import Link from "next/link"

/**
 * Общий подвал для дашбордов (teacher/student/admin).
 * Стили — в /public/dashboard/site-footer.css, разметка синхронизирована
 * с подвалом главной страницы (.raw2-footer): 4 ссылки слева, кнопка + копирайт
 * по центру, реквизиты справа.
 */
const TgIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M11.94 2.02a10 10 0 1 0 .12 20 10 10 0 0 0-.12-20Zm4.62 6.9-1.55 7.3c-.11.52-.42.64-.86.4l-2.38-1.76-1.15 1.1c-.13.13-.24.24-.48.24l.17-2.42 4.4-3.98c.19-.17-.04-.27-.3-.1l-5.43 3.42-2.34-.73c-.51-.16-.52-.51.11-.76l9.14-3.53c.42-.15.8.1.66.75Z" />
  </svg>
)

interface Props {
  supportHref?: string
  onSupportClick?: () => void
}
export default function SiteFooter({ supportHref = "/support", onSupportClick }: Props) {
  return (
    <footer className="sf-footer">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/site-footer.css?v=20260902-5" />

      <div className="sf-inner">
        <div className="sf-col sf-col-links">
          <a href="https://t.me/" target="_blank" rel="noreferrer" className="sf-tg">
            <TgIcon />Telegram
          </a>
          <a className="sf-mut" href="#">Связаться</a>
          <Link className="sf-mut" href="/oferta">Договор-оферта</Link>
          <Link className="sf-mut" href="/privacy">Политика конфиденциальности</Link>
        </div>

        <div className="sf-col sf-col-center">
          {onSupportClick ? (
            <button type="button" className="sf-support" onClick={onSupportClick}>
              Написать в поддержку
            </button>
          ) : (
            <Link href={supportHref} className="sf-support">Написать в поддержку</Link>
          )}
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
