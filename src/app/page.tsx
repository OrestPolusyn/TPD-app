import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getProvinces } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { SearchForm } from "@/components/search/SearchForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const supabase = await createClient();
  const [provinces, documentTypes] = await Promise.all([
    getProvinces(supabase),
    getActiveDocumentTypes(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>
      {/* Kept directly under the title (not inside the long SearchForm below)
          so it's visible without scrolling at 375px, per docs/SPEC.md. */}
      <Link
        href="/locations"
        className="rounded-md border border-[var(--accent)] px-4 py-2 text-center font-medium text-[var(--accent)]"
      >
        {t("shareCta")}
      </Link>
      <SearchForm provinces={provinces} documentTypes={documentTypes} />
    </main>
  );
}
