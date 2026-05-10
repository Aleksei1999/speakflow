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
  // TODO(security): добавить Content-Security-Policy отдельным раундом.
  // Нюансы для CSP:
  //   - connect-src: meet.raw-english.com (Jitsi), sb.raw-english.com
  //     (Supabase REST + WS), wss://* для realtime
  //   - img-src: lh3.googleusercontent.com (Google avatars), *.supabase.co
  //   - style-src: несколько dashboard-страниц используют
  //     <style dangerouslySetInnerHTML>, нужен 'unsafe-inline' либо nonce
  //   - frame-src: meet.raw-english.com (Jitsi iframe в /lesson)
  // Требует аккуратного раунда с тестированием каждой страницы.
  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;
