import { getTranslations } from "next-intl/server";
import type { UnconfirmedNote } from "@/lib/data/communityNotes";
import { formatDate } from "@/lib/format";

/**
 * Single chat reports nobody has confirmed yet, as comments at the bottom of
 * the office's page: worth knowing, but kept apart from the card so they are
 * not read as the office's rules.
 */
export async function UnconfirmedNotes({ notes }: { notes: UnconfirmedNote[] }) {
  if (notes.length === 0) return null;
  const t = await getTranslations("unconfirmed");

  return (
    <section aria-labelledby="unconfirmed-title" className="flex flex-col gap-2 text-sm">
      <h2 id="unconfirmed-title" className="font-medium">
        💬 {t("title")}
      </h2>
      <p className="text-xs text-[var(--muted)]">{t("hint")}</p>
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3 leading-snug">
            <span className="text-xs text-[var(--muted)]">{formatDate(n.observed_on)}</span>
            <p className="mt-0.5 whitespace-pre-line">{n.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
