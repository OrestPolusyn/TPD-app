import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ProvinceOption } from "@/lib/data/locations";
import type { DocumentTypeRow } from "@/lib/data/documentTypes";
import { CHECKLIST_DOCUMENT_CODES } from "@/lib/matching/types";

/**
 * Plain server-rendered <form method="get"> — no client JS needed for the
 * core interaction (native checkboxes/select/radio + browser navigation).
 * Keeps "/" well under the 150 KB gzipped client-JS budget and makes the
 * search trivially keyboard/no-JS accessible. The Telegram MainButton bridge
 * (Milestone 6) hooks into this same <form> via its id, it does not replace it.
 */
export async function SearchForm({
  provinces,
  documentTypes,
}: {
  provinces: ProvinceOption[];
  documentTypes: DocumentTypeRow[];
}) {
  const t = await getTranslations("home");
  const checklist = documentTypes.filter((d) => (CHECKLIST_DOCUMENT_CODES as readonly string[]).includes(d.code));

  return (
    <form id="search-form" action="/results" method="get" className="flex flex-col gap-5">
      <div>
        <label htmlFor="province" className="mb-1 block text-sm font-medium">
          {t("provinceLabel")}
        </label>
        <select
          id="province"
          name="province"
          required
          defaultValue=""
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
        >
          <option value="" disabled>
            {t("provincePlaceholder")}
          </option>
          {provinces.map((p) => (
            <option key={p.province_slug} value={p.province_slug}>
              {p.province}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("docsLabel")}</legend>
        <p className="mb-2 text-xs text-[var(--muted)]">{t("docsHint")}</p>
        <div className="flex flex-col gap-2">
          {checklist.map((d) => {
            const inputId = `doc-${d.code}`;
            return (
              <label key={d.code} htmlFor={inputId} className="flex items-center gap-2 text-sm">
                <input id={inputId} type="checkbox" name="docs" value={d.code} className="h-4 w-4" />
                {d.label_uk}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("militaryQuestionLabel")}</legend>
        <div className="flex gap-4 text-sm">
          {(["yes", "no", "prefer_not_to_say"] as const).map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input type="radio" name="mil" value={value} />
              {value === "yes" ? t("militaryOptionYes") : value === "no" ? t("militaryOptionNo") : t("militaryOptionPreferNotToSay")}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)]"
      >
        {t("searchButton")}
      </button>

      <Link
        href="/locations"
        className="rounded-md border border-[var(--accent)] px-4 py-2 text-center font-medium text-[var(--accent)]"
      >
        {t("shareCta")}
      </Link>
      <p className="text-xs text-[var(--muted)]">{t("shareCtaHint")}</p>
    </form>
  );
}
