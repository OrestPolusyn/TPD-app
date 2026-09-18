import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LocationRow } from "@/lib/matching/types";
import { config } from "@/lib/config";

/**
 * What the visitor actually came for: the procedure, not the building.
 *
 * Deliberately says nothing about who qualifies or which documents are
 * required — docs/SPEC.md: "It is not a list of 'required documents'. It never
 * tells a user they are eligible." Conditions come from the official page it
 * links to; everything below this block is explicitly community experience.
 */
export async function ProcedureBlock({ location }: { location: LocationRow }) {
  const t = await getTranslations("location");
  const officialInfoUrl = config.officialInfoUrl() ?? location.source_url;

  return (
    <section className="rounded-xl border border-[var(--accent)]/40 bg-[var(--surface)] p-4">
      <h2 className="font-medium">{t("procedureTitle")}</h2>
      <p className="mt-2 text-sm">
        {location.type === "creade" ? t("procedureIntroCreade") : t("procedureIntroPolice")}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("procedureOfficialNote")}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a
          href={officialInfoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          {t("procedureOfficialCta")}
        </a>
        <Link href="/faq" className="self-center underline">
          {t("procedureFaqCta")}
        </Link>
      </div>
    </section>
  );
}
