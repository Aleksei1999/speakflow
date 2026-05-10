import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  // Tree-shake heavy packages — каждая иконка lucide-react / каждая
  // функция date-fns импортится отдельно, без bundle всего пакета.
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "sonner"],
  },
  // Список host'ов где лежат внешние картинки (Supabase Storage, Google
  // OAuth-аватары). Без whitelist next/image не оптимизирует их.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Базовые security headers (defense-in-depth).
  // CSP сейчас в Report-Only режиме — ловим violations через
  // /api/csp-report и расширяем policy перед enforce.
  async headers() {
    // Content-Security-Policy: см. /api/csp-report для violation-логов.
    // Список директив выстроен так, чтобы покрыть текущие реальные
    // источники: Supabase (через прокси sb.raw-english.com и напрямую
    // *.supabase.co для совместимости), Jitsi (meet.raw-english.com),
    // Google OAuth avatars (lh3.googleusercontent.com), Google Fonts
    // (Gluten / Inter), Telegram CDN для аватаров (если попадётся).
    //
    // 'unsafe-inline' в style-src — необходимо: десятки dashboard-
    // страниц используют <style dangerouslySetInnerHTML> для scoped
    // CSS. Уберём после миграции на CSS Modules или nonce-based CSP.
    //
    // 'unsafe-eval' в script-src — Next.js dev/preview иногда требует;
    // в prod-Vite/SWC билде обычно не нужен. Оставляем пока в Report-
    // Only, потом попробуем убрать.
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://meet.raw-english.com https://accounts.google.com https://*.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://sb.raw-english.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://t.me",
      // connect-src: REST + WebSocket до Supabase (через прокси и напрямую),
      // Jitsi BOSH/XMPP, Vercel speed insights, плюс самопросмотр.
      "connect-src 'self' https://sb.raw-english.com wss://sb.raw-english.com https://*.supabase.co wss://*.supabase.co https://meet.raw-english.com wss://meet.raw-english.com https://vitals.vercel-insights.com https://*.ingest.sentry.io",
      "media-src 'self' blob: https://*.supabase.co https://sb.raw-english.com",
      "frame-src 'self' https://meet.raw-english.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://yoomoney.ru https://yookassa.ru",
      "object-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "report-uri /api/csp-report",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS-only год+: год HSTS + preload-ready.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Отключаем MIME-sniffing — браузер обязан уважать Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Свой сайт нигде не embed'им как iframe (Jitsi наоборот — он
          // у нас встраивается в /lesson, это его комната во фрейме).
          { key: "X-Frame-Options", value: "DENY" },
          // Не утекать полный URL referer на cross-origin запросах.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Камеру/микрофон НЕ запрещаем — Jitsi на /lesson их использует.
          // Геолокация, FLoC, Payment Request API нам не нужны.
          {
            key: "Permissions-Policy",
            value: "geolocation=(), interest-cohort=(), payment=()",
          },
          // CSP в Report-Only режиме: НЕ блокирует, но рассылает отчёты
          // о нарушениях на /api/csp-report. Когда отчёты перестанут
          // приходить (или будут только белый шум) — переключим на
          // Content-Security-Policy и enforce.
          { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
        ],
      },
    ];
  },
};

export default nextConfig;
