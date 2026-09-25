import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { RuleChange } from "@/lib/data/ruleChanges";
import { formatDate } from "@/lib/format";

/**
 * An office's latest rule changes, above everything else on its page: a
 * change is exactly what makes older reports and chat answers misleading,
 * so it has to be read first.
 */
export async function RecentRuleChanges({ changes, today }: { changes: RuleChange[]; today: string }) {
  if (changes.length === 0) return null;
  const t = await getTranslations("changes");

  return (
    <section
      aria-labelledby="recent-changes-title"
      className="rounded-[var(--radius-md)] border border-[var(--highlight-border)] bg-[var(--highlight-bg)] p-3 text-sm"
    >
      <h2 id="recent-changes-title" className="mb-1 font-medium">
        ⚠️ {t("recentTitle")}
      </h2>
      <ul className="flex flex-col gap-1">
        {changes.map((c) => (
          <li key={c.id} className="leading-snug">
            <span className="font-medium">
              {c.effective_date > today ? t("upcoming", { date: formatDate(c.effective_date) }) : formatDate(c.effective_date)}:
            </span>{" "}
            {c.title}
          </li>
        ))}
      </ul>
      <Link href="/changes" className="mt-1 inline-block text-xs underline">
        {t("allLink")}
      </Link>
    </section>
  );
}
