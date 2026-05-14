import Link from "next/link"

// `disabled: true` помечает ссылки, для которых пока нет страницы —
// они остаются на href="#" но с aria-label="скоро будет" и без hover-
// эффекта, чтобы юзер не натыкался на «битый» переход.
const footerLinks: Array<{
  title: string
  links: Array<{ href: string; label: string; disabled?: boolean }>
}> = [
  {
    title: "Платформа",
    links: [
      { href: "/teachers", label: "Преподаватели" },
      { href: "/#pricing", label: "Тарифы" },
      { href: "/#formats", label: "Speaking Clubs" },
      { href: "/get-started", label: "Тест уровня" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { href: "/#faq", label: "FAQ" },
      { href: "mailto:hello@raw-english.com", label: "Контакты" },
      { href: "#", label: "Помощь", disabled: true },
    ],
  },
  {
    title: "Документы",
    links: [
      { href: "/oferta", label: "Оферта" },
      { href: "/privacy", label: "Политика конфиденциальности" },
      { href: "#", label: "Правила платформы", disabled: true },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="bg-[#1E1E1E] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/">
              <img
                src="/logo-raw-full.svg"
                alt="RAW English"
                className="h-8 brightness-0 invert"
              />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              Онлайн-школа английского языка. Учитесь говорить, а не молчать.
            </p>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white">{group.title}</h3>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.disabled ? (
                      <span
                        className="text-sm text-white/40 cursor-not-allowed"
                        aria-label={`${link.label} — скоро будет`}
                        title="Скоро будет"
                      >
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-white/60 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-center text-sm text-white/40">
            &copy; {new Date().getFullYear()} RAW English by V. Kratkovskaya. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  )
}
