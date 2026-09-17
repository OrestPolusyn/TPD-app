import Link from "next/link";
import { getTranslations } from "next-intl/server";

const linkClassName = "text-[var(--muted)] no-underline transition-colors hover:text-[var(--foreground)]";

export async function NavBar() {
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur sm:px-6">
      <nav
        aria-label={t("home")}
        className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm"
      >
        <Link href="/" className="text-base font-semibold tracking-tight no-underline">
          TP Spain
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/locations" className={linkClassName}>
            {t("locations")}
          </Link>
          <Link href="/faq" className={linkClassName}>
            {t("faq")}
          </Link>
          <Link href="/about" className={linkClassName}>
            {t("about")}
          </Link>
          <Link href="/privacy" className={linkClassName}>
            {t("privacy")}
          </Link>
          <Link href="/me" className={linkClassName}>
            {t("me")}
          </Link>
          <Link
            href="/locations/new"
            className="rounded-full border border-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
          >
            {t("suggestCta")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
