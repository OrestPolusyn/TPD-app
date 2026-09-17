import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/shared/Card";

export default async function FaqPage() {
  const t = await getTranslations("faq");
  const tNav = await getTranslations("nav");
  const items = t.raw("items") as { q: string; a: string }[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <Card key={item.q}>
            <h2 className="mb-1 font-medium">{item.q}</h2>
            <p className="text-sm text-[var(--muted)]">{item.a}</p>
          </Card>
        ))}
      </div>

      <Link
        href="/locations/new"
        className="rounded-full border border-[var(--accent)] px-4 py-2 text-center font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
      >
        {tNav("suggestCta")}
      </Link>
    </main>
  );
}
