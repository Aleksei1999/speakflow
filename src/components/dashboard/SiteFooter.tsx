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
}
export default function SiteFooter({ supportHref = "/support", onSupportClick }: Props) {
  return (
    <footer className="sf-footer">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/dashboard/site-footer.css?v=20260908-figma" />

      <div className="sf-inner">
        <div className="sf-col sf-col-links">
          <a href="https://t.me/" target="_blank" rel="noreferrer" className="sf-tg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/raw2/ic-telegram.svg" alt="" aria-hidden />Telegram
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
