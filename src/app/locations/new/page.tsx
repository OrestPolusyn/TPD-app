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
  const [t, tCommon, tAuth] = await Promise.all([
    getTranslations("newLocationForm"),
    getTranslations("common"),
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
    descriptionLabel: t("descriptionLabel"),
    descriptionHint: t("descriptionHint"),
    submitButton: t("submitButton"),
    submitting: tCommon("submitting"),
    successMessage: t("successMessage"),
    pendingNotice: t("pendingNotice"),
    errorGeneric: tCommon("errorGeneric"),
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("intro")}</p>
      </div>
      <NewLocationForm labels={labels} />
    </main>
  );
}
