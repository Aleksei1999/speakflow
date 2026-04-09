"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Menu } from "lucide-react"

const navLinks = [
  { href: "/teachers", label: "Преподаватели" },
  { href: "/level-test", label: "Тест уровня" },
]

const dashboardByRole: Record<string, string> = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
}

interface MarketingHeaderProps {
  isAuthenticated?: boolean
  role?: string | null
}

export function MarketingHeader({
  isAuthenticated = false,
  role = null,
}: MarketingHeaderProps) {
  const [open, setOpen] = useState(false)
  const dashboardHref = dashboardByRole[role ?? "student"] ?? "/student"

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo-raw.svg" alt="RAW English" className="h-8" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Основная навигация">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Button
              size="sm"
              className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
              render={<Link href={dashboardHref} />}
            >
              Личный кабинет
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                Войти
              </Button>
              <Button
                size="sm"
                className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                render={<Link href="/register" />}
              >
                Регистрация
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            render={<button aria-label="Открыть меню" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>
                <img src="/logo-raw.svg" alt="RAW English" className="h-7" />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 px-4" aria-label="Мобильная навигация">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-3">
                {isAuthenticated ? (
                  <Button
                    className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                    render={<Link href={dashboardHref} />}
                    onClick={() => setOpen(false)}
                  >
                    Личный кабинет
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      render={<Link href="/login" />}
                      onClick={() => setOpen(false)}
                    >
                      Войти
                    </Button>
                    <Button
                      className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                      render={<Link href="/register" />}
                      onClick={() => setOpen(false)}
                    >
                      Регистрация
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
