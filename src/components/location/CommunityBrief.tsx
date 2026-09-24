import { getTranslations } from "next-intl/server";
import type { CommunityBrief as Brief } from "@/lib/data/communityNotes";
import { isBriefDisputed } from "@/lib/data/communityNotes";
import { BriefConfirm } from "@/components/location/BriefConfirm";
import { formatDate, daysSince } from "@/lib/format";

/** Past this with nobody vouching for it, the brief is a lead, not information. */
const STALE_AFTER_DAYS = 45;

/**
 * The office's requirements in two short lists, as the community chats report
 * them: which documents, and a handful of practical points.
 *
 * Kept deliberately small — it sits above the reports, and on a phone every
 * line it takes pushes the actual experiences further down. Individual
 * experiences belong in reports, where they carry a date, an outcome and a
 * comment thread; this is only the distilled checklist.
 */
export async function CommunityBrief({ locationId, brief }: { locationId: string; brief: Brief | null }) {
  if (!brief) return null;
  const t = await getTranslations("location");
  const tCommon = await getTranslations("common");
  const disputed = isBriefDisputed(brief);
  const stale = !disputed && brief.still_true === 0 && daysSince(brief.observed_on) > STALE_AFTER_DAYS;

  return (
    <section
      aria-labelledby="brief-title"
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 id="brief-title" className="font-medium">
          {t("briefTitle")}
        </h3>
        <span className="text-xs text-[var(--muted)]">{t("briefAsOf", { date: formatDate(brief.observed_on) })}</span>
      </div>

      {brief.documents.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t("briefDocuments")}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {brief.documents.map((line) => (
              <li key={line} className="flex gap-1.5 leading-snug">
                <span aria-hidden="true" className="text-[var(--accent)]">
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {brief.info.length > 0 ? (
        <>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t("briefInfo")}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {brief.info.map((line) => (
              <li key={line} className="flex gap-1.5 leading-snug">
                <span aria-hidden="true" className="text-[var(--muted)]">
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {disputed ? <p className="mt-2 text-xs text-[var(--warning)]">{t("briefDisputed")}</p> : null}
      {stale ? <p className="mt-2 text-xs text-[var(--muted)]">{t("briefStale")}</p> : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
        <span className="text-xs text-[var(--muted)]">{t("briefSource")}</span>
        <BriefConfirm
          locationId={locationId}
          stance={brief.my_stance}
          stillTrue={brief.still_true}
          changed={brief.changed}
          labels={{
            question: t("briefQuestion"),
            confirm: t("briefConfirm"),
            deny: t("briefDeny"),
            signIn: t("briefSignIn"),
            generic: tCommon("errorGeneric"),
          }}
        />
      </div>
    </section>
  );
}
