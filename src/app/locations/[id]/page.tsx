import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationById } from "@/lib/data/locations";
import { getFlaggedReportsForLocation, getReportDetails, getCommentsForReports } from "@/lib/data/reports";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { getCommunityBrief } from "@/lib/data/communityNotes";
import { OfficialBlock } from "@/components/location/OfficialBlock";
import { LocationSummary } from "@/components/location/LocationSummary";
import { CommunityBlock } from "@/components/location/CommunityBlock";
import { ShareActions } from "@/components/location/ShareActions";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { StickyActionBar } from "@/components/shared/StickyActionBar";
import { PROCEDURE_CODE } from "@/lib/matching/types";
import { config } from "@/lib/config";
import { normalizeDocsParam } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

interface LocationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ docs?: string | string[]; mil?: string }>;
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const location = await getLocationById(supabase, id);
  if (!location || location.moderation_status !== "published") {
    return { title: "TP Spain" };
  }
  const title = `${location.name} — TP Spain`;
  const description = (await getTranslations("location"))("ogDescription", {
    city: location.city,
    province: location.province,
  });
  const url = `${config.siteUrl()}/locations/${location.id}`;
  return {
    title,
    description,
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function LocationPage({ params, searchParams }: LocationPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const location = await getLocationById(supabase, id);
  if (!location || location.moderation_status !== "published") {
    notFound();
  }

  const userDocs = normalizeDocsParam(query.docs);

  const { data: matchingData, error: matchingError } = await supabase.rpc("fn_location_page_data", {
    p_location_id: location.id,
    p_procedure_code: PROCEDURE_CODE,
    p_user_docs: userDocs,
    p_military_filter: null,
  });
  if (matchingError) throw matchingError;

  const allReportIds = [
    ...matchingData.matches,
    ...matchingData.incomplete,
    ...matchingData.more_docs,
    ...matchingData.unsuccessful,
  ].map((r: { report_id: string }) => r.report_id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [reportDetails, flaggedReports, documentTypes, brief] = await Promise.all([
    getReportDetails(supabase, allReportIds),
    getFlaggedReportsForLocation(supabase, location.id, PROCEDURE_CODE),
    getActiveDocumentTypes(supabase),
    getCommunityBrief(supabase, location.id, user?.id ?? null),
  ]);

  const comments = await getCommentsForReports(supabase, [
    ...allReportIds,
    ...flaggedReports.map((r) => r.id),
  ]);

  const documentLabels = new Map(documentTypes.map((d) => [d.code, d.label_uk]));

  const webUrl = `${config.siteUrl()}/locations/${location.id}`;
  const botUsername = config.telegramBotUsername();
  const miniAppName = config.telegramMiniAppName();
  const telegramUrl =
    botUsername && miniAppName ? `https://t.me/${botUsername}/${miniAppName}?startapp=loc_${location.id}` : null;
  const tShare = await getTranslations("location");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{location.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {location.city}, {location.province}
        </p>
      </div>
      <LocationSummary reports={[...reportDetails.values()]} documentLabels={documentLabels} />
      <ShareActions
        webUrl={webUrl}
        telegramUrl={telegramUrl}
        labels={{
          copyLink: tShare("shareCopyLink"),
          copySuccess: tShare("shareCopySuccess"),
          openTelegram: tShare("shareOpenTelegram"),
        }}
      />
      <CommunityBlock
        locationId={location.id}
        brief={brief}
        signedIn={!!user}
        data={matchingData}
        reportDetails={reportDetails}
        flaggedReports={flaggedReports}
        documentLabels={documentLabels}
        comments={comments}
      />
      <OfficialBlock location={location} />
      <Disclaimer />
      <StickyActionBar href={`/reports/new?location=${location.id}`} label={tShare("addReportCta")} />
    </main>
  );
}
