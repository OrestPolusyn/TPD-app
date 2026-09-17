import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { NewLocationForm, type NewLocationFormLabels } from "@/components/reports/NewLocationForm";

export const dynamic = "force-dynamic";

export default async function NewLocationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [t, tMethods, tAuth] = await Promise.all([
    getTranslations("newLocationForm"),
    getTranslations("appointmentMethods"),
    getTranslations("auth"),
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

  const labels: NewLocationFormLabels = {
    nameLabel: t("nameLabel"),
    typeLabel: t("typeLabel"),
    provinceLabel: t("provinceLabel"),
    regionLabel: t("regionLabel"),
    cityLabel: t("cityLabel"),
    addressLabel: t("addressLabel"),
    postalCodeLabel: t("postalCodeLabel"),
    phoneLabel: t("phoneLabel"),
    appointmentMethodLabel: t("appointmentMethodLabel"),
    appointmentUrlLabel: t("appointmentUrlLabel"),
    submitButton: t("submitButton"),
    submitting: (await getTranslations("common"))("submitting"),
    duplicateWarning: t("duplicateWarning"),
    successMessage: t("successMessage"),
    pendingNotice: t("pendingNotice"),
    errorGeneric: (await getTranslations("common"))("errorGeneric"),
    appointmentMethods: {
      phone: tMethods("phone"),
      email: tMethods("email"),
      phone_or_email: tMethods("phone_or_email"),
      icp_online: tMethods("icp_online"),
    },
    locationTypes: {
      creade: t("locationTypeCreade"),
      police_station: t("locationTypePoliceStation"),
    },
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <NewLocationForm labels={labels} />
    </main>
  );
}
