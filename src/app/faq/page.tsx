import { getTranslations } from "next-intl/server";
import { FaqAccordion, type FaqItem } from "@/components/faq/FaqAccordion";

export default async function FaqPage() {
  const t = await getTranslations("faq");
  const items = t.raw("items") as FaqItem[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <FaqAccordion
        items={items}
        labels={{
          searchLabel: t("searchLabel"),
          searchPlaceholder: t("searchPlaceholder"),
          noMatches: t("noMatches"),
        }}
      />
    </main>
  );
}
