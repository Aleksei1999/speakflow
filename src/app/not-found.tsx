import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">Страница не найдена / Page not found</p>
      <Link href="/" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        На главную
      </Link>
    </div>
  )
}
