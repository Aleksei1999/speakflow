import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RAW English — Авторизация',
  description: 'Вход и регистрация на платформе RAW English',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div
          className="flex size-12 items-center justify-center rounded-xl text-xl font-bold text-white"
          style={{ backgroundColor: '#722F37' }}
        >
          RE
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#722F37' }}>
          RAW English
        </h1>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
