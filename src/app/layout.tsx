import type { Metadata } from "next";
import { Inter, Gluten } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Preloader } from "@/components/layout/preloader";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

// Gluten — акцентный «рукописный» шрифт. В CSS используется только
// font-weight: 600/700 (для 800 браузер берёт ближайшее = 700, для 600
// — точный матч). Раньше декларировали 400/500/700 — 400 и 500 не
// использовались, а 600 матчился промежуточно из 500. Сократили до
// фактически используемого набора → меньше @font-face деклараций в
// preloaded CSS, меньше preload-хинтов в HTML.
const gluten = Gluten({
  variable: "--font-gluten",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "RAW English — Платформа для изучения английского",
  description: "Онлайн-платформа для изучения английского языка с AI-репетитором",
};

// Read the public `rwen_authed` cookie BEFORE React hydration and set
// data-authed / data-role on <html>. This lets the statically-cached
// landing render the correct nav CTA (Личный кабинет vs Войти) without
// waiting for the client-side useUser() Supabase round-trip and without
// turning the page into force-dynamic — keeping ISR intact.
const authBootstrapScript = `(function(){try{var m=document.cookie.match(/(?:^|; )rwen_authed=([^;]+)/);var r=m?decodeURIComponent(m[1]):'';var html=document.documentElement;if(r){html.setAttribute('data-authed','1');html.setAttribute('data-role',r);}else{html.removeAttribute('data-authed');html.removeAttribute('data-role');}}catch(e){}})();`

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Single-locale runtime: next-intl resolves the locale per-request from
  // the rwen_locale cookie via src/i18n/request.ts. We just need the
  // resolved value here to set <html lang> and pass messages to the
  // client provider once.
  const locale = await getLocale();
  const messages = await getMessages();
  const skipLabel =
    (messages as any)?.common?.skipToContent ??
    (locale === "en" ? "Skip to main content" : "Перейти к основному содержимому");

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${gluten.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: authBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* WCAG 2.4.1 Bypass Blocks: skip-link для клавиатуры/SR.
              Виден только когда сфокусирован (через :focus в globals.css). */}
          <a href="#main" className="skip-link">{skipLabel}</a>
          <Preloader />
          <main id="main" className="flex-1 flex flex-col">
            {children}
          </main>
          {/* Vercel Speed Insights — Core Web Vitals (LCP/INP/CLS/FCP/TTFB).
              Дашборд: vercel.com/<team>/<project>/speed-insights. Sample
              rate 100% по дефолту, минимальный overhead (~3 KB gzipped). */}
          <SpeedInsights />
          {/* Vercel Web Analytics — page views, custom events. Без cookies,
              GDPR-safe. Dashboard: vercel.com/<team>/<project>/analytics. */}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
