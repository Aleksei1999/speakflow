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

### Production checklist (обязательные env)

Перед прод-релизом убедитесь, что в Vercel заданы:

| Переменная | Зачем |
|------------|--------|
| `CRON_SECRET` | `/api/internal/cron/*` — без него cron 401 |
| `INTERNAL_API_SECRET` | `/api/notifications/send` |
| `TELEGRAM_WEBHOOK_SECRET` | `/api/notifications/telegram` |
| `RW_ROLE_COOKIE_SECRET` | подпись role-cookie в middleware |
| `ARCJET_KEY` | shield/bot detection (без ключа — fail-open) |
| `TURNSTILE_SECRET_KEY` | server verify CAPTCHA |
| `VIRUSTOTAL_API_KEY` | AV scan загрузок |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | rate-limit (иначе Postgres fallback) |

Опционально: `ENABLE_ADMIN_MFA_ENFORCE=1` после того, как у всех админов включён TOTP.

Скопируйте шаблон из `.env.example` в `.env.local` для локальной разработки.

## Лицензия

Proprietary. © Raw English, 2026.
