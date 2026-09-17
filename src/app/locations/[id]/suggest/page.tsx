import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationById } from "@/lib/data/locations";
import { SuggestForm, type SuggestFormLabels } from "@/components/reports/SuggestForm";

export const dynamic = "force-dynamic";

export default async function SuggestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [location, { data: { user } }, t, tAuth] = await Promise.all([
    getLocationById(supabase, id),
    supabase.auth.getUser(),
    getTranslations("suggestForm"),
    getTranslations("auth"),
  ]);

  if (!location || location.moderation_status !== "published") {
    notFound();
  }

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

  const labels: SuggestFormLabels = {
    fieldLabel: t("fieldLabel"),
    fieldNames: {
      address: t("fieldAddress"),
      postal_code: t("fieldPostalCode"),
      phone: t("fieldPhone"),
      appointment_url: t("fieldAppointmentUrl"),
    },
    currentValueLabel: t("currentValueLabel"),
    proposedValueLabel: t("proposedValueLabel"),
    submitButton: t("submitButton"),
    submitting: (await getTranslations("common"))("submitting"),
    successMessage: t("successMessage"),
    errorGeneric: (await getTranslations("common"))("errorGeneric"),
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-sm text-[var(--muted)]">{location.name}</p>
      <SuggestForm location={location} labels={labels} />
    </main>
  );
}
