# Raw English

Платформа онлайн-уроков английского с интегрированной видеосвязью, геймификацией и Speaking Clubs.

**Live:** [raw-english.com](https://raw-english.com)

## Стек

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Backend:** Supabase (Postgres 17 + Auth + Storage + Realtime + Edge Functions)
- **Видеосвязь:** self-hosted Jitsi Meet + coturn (TURN/STUN)
- **Платежи:** YooKassa
- **Уведомления:** Resend (email) + Telegram Bot API
- **Хостинг:** Vercel + Cloudflare DNS + nginx reverse-proxy на VPS
- **AI:** OpenAI gpt-4o-transcribe (запись урока → транскрипт → саммари + квиз)
- **Observability:** Sentry + Vercel Speed Insights
- **Security:** Upstash Redis rate-limiting, Arcjet shield + bot detection, VirusTotal AV scan, Cloudflare Turnstile, MFA TOTP

## Структура

```
src/
├── app/                  # Next.js App Router (страницы + API)
│   ├── (auth)/          # /login /register /forgot /reset
│   ├── (marketing)/     # лендинг
│   ├── (dashboard)/     # /student /teacher /admin
│   └── api/             # REST endpoints
├── components/          # React-компоненты
├── lib/                 # серверные хелперы (Supabase, Jitsi, Resend, …)
├── hooks/               # клиентские хуки
├── i18n/                # next-intl messages (ru + en)
└── types/               # TypeScript типы

supabase/
└── migrations/          # SQL миграции (083+ актуальных)
```

## Локальный запуск

```bash
npm install
npm run dev
# открой http://localhost:3000
```

Нужны `.env.local` с креденшелами Supabase, OpenAI, Resend, YooKassa, Jitsi и т.д.

## Деплой

```bash
npx vercel deploy --prod
npx vercel alias set <deployment-url> raw-english.com
```

## Лицензия

Proprietary. © Raw English, 2026.
