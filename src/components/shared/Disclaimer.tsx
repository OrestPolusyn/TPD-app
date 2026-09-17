import { getTranslations } from "next-intl/server";
import { config } from "@/lib/config";

/** Required on every results and location page (docs/SPEC.md "Copy rules"). */
export async function Disclaimer() {
  const t = await getTranslations("common");
  const officialInfoUrl = config.officialInfoUrl();

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--highlight-bg)]/40 p-3 text-sm">
      <p className="font-medium">{t("disclaimer")}</p>
      {officialInfoUrl ? (
        <a href={officialInfoUrl} target="_blank" rel="noopener noreferrer" className="underline">
          {t("officialInfoLink")}
        </a>
      ) : null}
    </div>
  );
}
