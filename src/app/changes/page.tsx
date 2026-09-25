import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRuleChanges } from "@/lib/data/ruleChanges";
import { formatDate } from "@/lib/format";
import { madridDate } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Зміни правил — TP Spain" };

/**
 * Dated changes to how offices work — the things that make yesterday's
 * answer in a chat wrong today. Newest first; future-dated entries
 * ("очікується") are marked as such.
 */
export default async function ChangesPage() {
  const t = await getTranslations("changes");
  const supabase = await createClient();
  const changes = await getRuleChanges(supabase, { limit: 200 });
  const today = madridDate(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      {changes.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {changes.map((c) => {
            const upcoming = c.effective_date > today;
            return (
              <li
                key={c.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  {c.location_id ? (
                    <Link href={`/locations/${c.location_id}`} className="font-medium underline">
                      {c.city}
                    </Link>
                  ) : (
                    <span className="font-medium">{t("allOffices")}</span>
                  )}
                  <span className={`text-xs ${upcoming ? "font-medium text-[var(--warning)]" : "text-[var(--muted)]"}`}>
                    {upcoming ? t("upcoming", { date: formatDate(c.effective_date) }) : formatDate(c.effective_date)}
                  </span>
                </div>
                <p className="mt-1">{c.title}</p>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-[var(--muted)]">{t("source")}</p>
    </main>
  );
}
