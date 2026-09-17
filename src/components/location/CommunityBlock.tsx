import { getTranslations } from "next-intl/server";
import type { LocationPageData, MatchedReport } from "@/lib/matching/types";
import type { ReportDetail, CommentRow } from "@/lib/data/reports";
import { OutcomeLabel } from "@/components/shared/OutcomeLabel";
import { formatDate } from "@/lib/format";

type Translator = Awaited<ReturnType<typeof getTranslations<"location">>>;

async function ReportCard({
  detail,
  extraDocs,
  documentLabels,
  comments,
  t,
}: {
  detail: ReportDetail;
  extraDocs?: string[];
  documentLabels: Map<string, string>;
  comments: CommentRow[];
  t: Translator;
}) {
  const requested = detail.documents.filter((d) => d.status === "requested").map((d) => documentLabels.get(d.document_code) ?? d.document_code);
  const missing = detail.documents.filter((d) => d.status === "requested_missing").map((d) => documentLabels.get(d.document_code) ?? d.document_code);
  const tTimeAtOffice = await getTranslations("timeAtOffice");
  const tAppointmentType = await getTranslations("appointmentTypes");

  return (
    <li className="rounded-md border border-[var(--border)] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <OutcomeLabel outcome={detail.outcome} />
        <span className="text-[var(--muted)]">{t("reportDate", { date: formatDate(detail.event_date) })}</span>
      </div>

      {detail.appointment_type ? <p className="mt-1">{tAppointmentType(detail.appointment_type)}</p> : null}
      {detail.time_at_office ? <p>{t("reportTimeAtOffice", { value: tTimeAtOffice(detail.time_at_office) })}</p> : null}
      {detail.people_count ? <p>{t("reportPeopleCount", { count: detail.people_count })}</p> : null}
      {detail.earliest_appointment_offered ? (
        <p>{t("reportEarliestAppointment", { date: formatDate(detail.earliest_appointment_offered) })}</p>
      ) : null}

      {requested.length > 0 ? <p className="mt-1">{t("reportRequestedDocs", { docs: requested.join(", ") })}</p> : null}
      {missing.length > 0 ? <p>{t("reportMissingDocs", { docs: missing.join(", ") })}</p> : null}

      {extraDocs && extraDocs.length > 0 ? (
        <p className="mt-1 font-medium">
          {t("moreDocsExtra", { docs: extraDocs.map((c) => documentLabels.get(c) ?? c).join(", ") })}
        </p>
      ) : null}

      {detail.comment ? <p className="mt-2 whitespace-pre-wrap">{detail.comment}</p> : null}

      <p className="mt-2 text-xs text-[var(--muted)]">{t("author")}</p>

      {comments.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-[var(--border)] pt-2">
          {comments
            .filter((c) => c.moderation_status === "published" || c.moderation_status === "flagged")
            .map((c) => (
              <li key={c.id} className="text-sm">
                <span className="whitespace-pre-wrap">{c.body}</span>
                <span className="ml-2 text-xs text-[var(--muted)]">{t("author")}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </li>
  );
}

export async function CommunityBlock({
  locationId,
  data,
  reportDetails,
  flaggedReports,
  documentLabels,
  comments,
}: {
  locationId: string;
  data: LocationPageData;
  reportDetails: Map<string, ReportDetail>;
  flaggedReports: ReportDetail[];
  documentLabels: Map<string, string>;
  comments: Map<string, CommentRow[]>;
}) {
  const t = await getTranslations("location");

  function detailsFor(list: MatchedReport[]) {
    return list
      .map((m) => ({ meta: m, detail: reportDetails.get(m.report_id) }))
      .filter((r): r is { meta: MatchedReport; detail: ReportDetail } => !!r.detail);
  }

  const matches = detailsFor(data.matches);
  const incomplete = detailsFor(data.incomplete);
  const moreDocs = detailsFor(data.more_docs);
  const unsuccessful = detailsFor(data.unsuccessful);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium">{t("communityBlockTitle")}</h2>

      {data.policy_change ? (
        <p role="note" className="rounded bg-[var(--highlight-bg)] p-2 text-sm">
          {t("policyChangeLabel", { date: formatDate(data.policy_change.effective_date), title: data.policy_change.title_uk })}{" "}
          <a href={data.policy_change.source_url} className="underline" target="_blank" rel="noopener noreferrer">
            {data.policy_change.source_url}
          </a>
        </p>
      ) : null}

      {data.not_requested.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t("notRequestedTitle")}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {data.not_requested.map((line) => (
              <li
                key={line.document_code}
                className={line.highlighted ? "inline-block w-fit rounded bg-[var(--highlight-bg)] px-2 py-1 border border-[var(--highlight-border)]" : ""}
              >
                {["military_document_paper", "military_document_reserve_plus", "passport_exit_stamp"].includes(line.document_code)
                  ? t("notRequestedMilitaryLine", { label: documentLabels.get(line.document_code) ?? line.document_code, count: line.user_count })
                  : t("notRequestedLine", { label: documentLabels.get(line.document_code) ?? line.document_code, count: line.user_count })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-3 text-sm">
        <a href={`/reports/new?location=${locationId}`} className="rounded-md border border-[var(--border)] px-3 py-1.5 font-medium">
          {t("sameExperienceButton")}
        </a>
        <a href={`/reports/new?location=${locationId}`} className="rounded-md border border-[var(--border)] px-3 py-1.5 font-medium">
          {t("differentExperienceButton")}
        </a>
        <a href={`/locations/${locationId}/suggest`} className="underline self-center">
          {t("suggestEditButton")}
        </a>
      </div>

      {matches.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t("matchesTitle")}</h3>
          <ul className="flex flex-col gap-2">
            {matches.map(({ meta, detail }) => (
              <ReportCard key={meta.report_id} detail={detail} documentLabels={documentLabels} comments={comments.get(meta.report_id) ?? []} t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      {incomplete.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t("incompleteTitle")}</h3>
          <ul className="flex flex-col gap-2">
            {incomplete.map(({ meta, detail }) => (
              <ReportCard key={meta.report_id} detail={detail} documentLabels={documentLabels} comments={comments.get(meta.report_id) ?? []} t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      {moreDocs.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t("moreDocsTitle")}</h3>
          <ul className="flex flex-col gap-2">
            {moreDocs.map(({ meta, detail }) => (
              <ReportCard
                key={meta.report_id}
                detail={detail}
                extraDocs={meta.extra_docs}
                documentLabels={documentLabels}
                comments={comments.get(meta.report_id) ?? []}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {unsuccessful.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">{t("unsuccessfulTitle")}</h3>
          <ul className="flex flex-col gap-2">
            {unsuccessful.map(({ meta, detail }) => (
              <ReportCard key={meta.report_id} detail={detail} documentLabels={documentLabels} comments={comments.get(meta.report_id) ?? []} t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      {flaggedReports.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {t("flaggedLabel")} ({flaggedReports.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {flaggedReports.map((detail) => (
              <ReportCard key={detail.id} detail={detail} documentLabels={documentLabels} comments={comments.get(detail.id) ?? []} t={t} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
