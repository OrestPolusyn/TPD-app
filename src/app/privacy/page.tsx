import { getTranslations } from "next-intl/server";
import { getPrivacyConfig } from "@/lib/config";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const privacyConfig = getPrivacyConfig();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {!privacyConfig ? (
        <div role="alert" className="rounded-md border-2 border-dashed border-[var(--highlight-border)] bg-[var(--highlight-bg)] p-3 text-sm font-medium">
          {t("controllerMissingDev")}
        </div>
      ) : null}

      <section>
        <h2 className="mb-1 font-medium">{t("whatWeStoreTitle")}</h2>
        <p className="text-sm">{t("whatWeStoreBody")}</p>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("whyTitle")}</h2>
        <p className="text-sm">{t("whyBody")}</p>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("retentionTitle")}</h2>
        <p className="text-sm">{t("retentionBody")}</p>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("deletionTitle")}</h2>
        <p className="text-sm">{t("deletionBody")}</p>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("contactTitle")}</h2>
        {privacyConfig ? (
          <dl className="text-sm">
            <dt className="text-[var(--muted)]">{t("controllerLabel")}</dt>
            <dd className="mb-2">{privacyConfig.controllerName}</dd>
            <dt className="text-[var(--muted)]">{t("contactLabel")}</dt>
            <dd>
              <a href={`mailto:${privacyConfig.contactEmail}`} className="underline">
                {privacyConfig.contactEmail}
              </a>
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">—</p>
        )}
      </section>
    </main>
  );
}
