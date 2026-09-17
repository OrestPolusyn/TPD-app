import Link from "next/link";
import { getTranslations } from "next-intl/server";
import packageJson from "../../../package.json";

export async function Footer() {
  const t = await getTranslations("nav");
  return (
    <footer className="border-t border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)] sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={t("about")} className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/about" className="underline">
            {t("about")}
          </Link>
          <Link href="/faq" className="underline">
            {t("faq")}
          </Link>
          <Link href="/privacy" className="underline">
            {t("privacy")}
          </Link>
        </nav>
        <span>TP Spain v{packageJson.version}</span>
      </div>
    </footer>
  );
}
