import Link from "next/link"
import { Separator } from "@/components/ui/separator"

const footerLinks = [
  {
    title: "Платформа",
    links: [
      { href: "/teachers", label: "Преподаватели" },
      { href: "/level-test", label: "Тест уровня" },
      { href: "/pricing", label: "Цены" },
    ],
  },
  {
    title: "Компания",
    links: [
      { href: "/about", label: "О нас" },
      { href: "/blog", label: "Блог" },
      { href: "/contacts", label: "Контакты" },
    ],
  },
  {
    title: "Правовая информация",
    links: [
      { href: "/privacy", label: "Политика конфиденциальности" },
      { href: "/terms", label: "Пользовательское соглашение" },
      { href: "/offer", label: "Оферта" },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="inline-flex items-center">
              <span
                className="text-xl font-bold tracking-tight"
                style={{ color: "#722F37" }}
              >
                RAW English
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Онлайн-платформа для изучения английского языка с лучшими
              преподавателями, AI-инструментами и геймификацией.
            </p>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} RAW English. Все права защищены.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://t.me/rawenglish"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Telegram
            </Link>
            <Link
              href="mailto:info@rawenglish.ru"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              info@rawenglish.ru
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
