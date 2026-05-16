import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl plugin — points to the request config file. The site is
// single-locale at runtime (no /en/... prefix), but next-intl is still
// used as a messages / formatting provider. See src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
  // CSP теперь dual-header:
  //   enforce  — Content-Security-Policy (без 'unsafe-eval' в prod)
  //   report-only — более строгий, без 'unsafe-inline' в script-src,
  //                 чтобы ловить будущие нарушения перед миграцией.
  async headers() {
    const isProd = process.env.NODE_ENV === "production"

    // Базовые директивы общие для enforce и report-only.
    // 'unsafe-inline' в style-src оставляем — много <style dangerouslySetInnerHTML>
    // для scoped CSS в dashboard. Убирать после миграции на CSS Modules.
    const commonDirectives = [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://sb.raw-english.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://t.me",
      "connect-src 'self' https://sb.raw-english.com wss://sb.raw-english.com https://*.supabase.co wss://*.supabase.co https://meet.raw-english.com wss://meet.raw-english.com https://vitals.vercel-insights.com https://*.ingest.sentry.io",
      "media-src 'self' blob: https://*.supabase.co https://sb.raw-english.com",
      "frame-src 'self' https://meet.raw-english.com https://accounts.google.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://yoomoney.ru https://yookassa.ru",
      "object-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "report-uri /api/csp-report",
    ]

    // ENFORCE policy (защищает реально):
    //   - 'unsafe-inline' в script-src нужен пока для inline-bootstrap скриптов
    //     в layout.tsx (cookie-read для data-theme/auth до hydration).
    //     Переход на nonce-based CSP — отдельная задача.
    //   - 'unsafe-eval' оставляем только в dev (Next.js использует для HMR).
    const scriptSrcEnforce =
      "script-src 'self' 'unsafe-inline' " +
      (isProd ? "" : "'unsafe-eval' ") +
      "https://meet.raw-english.com https://accounts.google.com https://*.vercel-scripts.com https://challenges.cloudflare.com"

    const enforceDirectives = [
      ...commonDirectives,
      scriptSrcEnforce,
    ].join("; ")

    // REPORT-ONLY policy (строже, проверяем будущее enforce):
    //   - БЕЗ 'unsafe-inline' в script-src — все нарушения видны в /api/csp-report
    //   - БЕЗ 'unsafe-eval' даже в dev
    const reportOnlyDirectives = [
      ...commonDirectives.map((d) =>
        d.startsWith("style-src ")
          ? "style-src 'self' https://fonts.googleapis.com"
          : d
      ),
      "script-src 'self' https://meet.raw-english.com https://accounts.google.com https://*.vercel-scripts.com https://challenges.cloudflare.com",
    ].join("; ")

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), interest-cohort=(), payment=()",
          },
          // Enforce: блокирует то что точно безопасно блокировать.
          { key: "Content-Security-Policy", value: enforceDirectives },
          // Report-Only: ловит нарушения для более строгой будущей policy.
          { key: "Content-Security-Policy-Report-Only", value: reportOnlyDirectives },
        ],
      },
    ];
  },
};

// Sentry обёртка: ставит source-maps, расширяет webpack, прокси
// /monitoring → ingest sentry (обходит ad-blockers). Активируется
// только если SENTRY_AUTH_TOKEN задан — иначе билд проходит без
// загрузки maps.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG ?? "raw-english",
  project: process.env.SENTRY_PROJECT ?? "raw-english-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: true },
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: true,
});
