import type { Metadata } from "next";
import { Inter, Gluten } from "next/font/google";
import { Preloader } from "@/components/layout/preloader";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const gluten = Gluten({
  variable: "--font-gluten",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${inter.variable} ${gluten.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: authBootstrapScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Preloader />
        {children}
      </body>
    </html>
  );
}
