import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { NavBar } from "@/components/shared/NavBar";
import { Footer } from "@/components/shared/Footer";
import { TelegramProvider } from "@/components/telegram/TelegramProvider";
import { BackButtonBridge } from "@/components/telegram/BackButtonBridge";
import "./globals.css";

// Self-hosted (next/font downloads at build time, no runtime request to
// Google Fonts) — needs the cyrillic subset since every string in this app is
// Ukrainian. display: "swap" avoids a flash-of-invisible-text while it loads.
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });

// Deliberately no NextIntlClientProvider here: every page in this app either
// renders fully on the server (using next-intl's getTranslations/useTranslations
// in Server Components, which need no provider) or is a small client island
// that receives its already-translated strings as props (see ShareActions).
// Wrapping the whole app in the provider would force React's client hydration
// runtime onto every route just to carry translation context nothing needs,
// which is what pushed "/"'s first-load JS over the 150 KB budget.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: "TP Spain",
    description: t("description"),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below sets data-theme on
    // this element before React hydrates, so the server's markup and the
    // client's differ here by design. It covers this element's attributes
    // only, not the tree inside it.
    <html lang="uk" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies a stored dark-mode choice before the first paint. Anything
            later — an effect, a client component — paints light first and then
            flips, which is the flash this exists to avoid. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        <TelegramProvider>
          <BackButtonBridge />
          <NavBar />
          {children}
          <Footer />
        </TelegramProvider>
      </body>
    </html>
  );
}
