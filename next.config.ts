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
};

export default nextConfig;
