import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NavBar } from "@/components/shared/NavBar";
import { TelegramProvider } from "@/components/telegram/TelegramProvider";
import { BackButtonBridge } from "@/components/telegram/BackButtonBridge";
import "./globals.css";

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
    <html lang="uk" className="h-full">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        <TelegramProvider>
          <BackButtonBridge />
          <NavBar />
          {children}
        </TelegramProvider>
      </body>
    </html>
  );
}
