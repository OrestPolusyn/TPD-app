import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnReportForEdit } from "@/lib/data/reports";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { getLocationById } from "@/lib/data/locations";
import { ReportForm } from "@/components/reports/ReportForm";
import { buildReportFormLabels } from "@/lib/reportFormLabels";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReportPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    tReportForm,
    tAuth,
    tErrors,
    labels,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getTranslations("reportForm"),
    getTranslations("auth"),
    getTranslations("errors"),
    buildReportFormLabels(),
  ]);

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4 sm:p-6">
        <p className="text-sm">{tAuth("loginHint")}</p>
        <Link href="/me" className="underline text-sm">
          {tAuth("loginTitle")}
        </Link>
      </main>
    );
  }

  const [report, documentTypes] = await Promise.all([
    getOwnReportForEdit(supabase, user.id, id),
    getActiveDocumentTypes(supabase),
  ]);
  if (!report) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4 sm:p-6">
        <p className="text-sm">{tErrors("notFound")}</p>
      </main>
    );
  }

  const location = await getLocationById(supabase, report.location_id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{tReportForm("editTitle")}</h1>
      {location ? <p className="text-sm text-[var(--muted)]">{location.name}</p> : null}
      <ReportForm
        locationId={report.location_id}
        documentTypes={documentTypes}
        labels={labels}
        reportId={report.id}
        initialValues={{
          event_date: report.event_date,
          outcome: report.outcome,
          documents:
            report.documents.length > 0
              ? report.documents.map((d) => ({ document_code: d.document_code, status: d.status as "requested" | "requested_missing" }))
              : [{ document_code: "", status: "requested" }],
          appointment_type: report.appointment_type ?? "",
          earliest_appointment_offered: report.earliest_appointment_offered ?? "",
          time_at_office: report.time_at_office ?? "",
          people_count: report.people_count ? String(report.people_count) : "",
          military_obligations_apply: report.military_obligations_apply ?? "",
          comment: report.comment ?? "",
        }}
      />
    </main>
  );
}
