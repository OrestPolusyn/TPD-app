import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function NavBar() {
  const t = await getTranslations("nav");
  return (
    <header className="border-b border-[var(--border)] px-4 py-2">
      <nav aria-label={t("home")} className="mx-auto flex w-full max-w-2xl flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/" className="font-semibold no-underline">
          TP Spain
        </Link>
        <Link href="/locations" className="underline">
          {t("locations")}
        </Link>
        <Link href="/about" className="underline">
          {t("about")}
        </Link>
        <Link href="/privacy" className="underline">
          {t("privacy")}
        </Link>
        <Link href="/me" className="underline">
          {t("me")}
        </Link>
      </nav>
    </header>
  );
}
