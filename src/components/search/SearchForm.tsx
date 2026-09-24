import Form from "next/form";
import { getTranslations } from "next-intl/server";
import type { DocumentTypeRow } from "@/lib/data/documentTypes";
import { CHECKLIST_DOCUMENT_CODES } from "@/lib/matching/types";
import { MainButtonBridge } from "@/components/telegram/MainButtonBridge";
import { SubmitButton } from "@/components/search/SubmitButton";

/**
 * Server-rendered GET form. The inputs stay native (select/checkbox/radio), so
 * it remains keyboard- and no-JS-accessible and "/" stays inside the 150 KB
 * gzipped client-JS budget. The Telegram MainButton bridge (Milestone 6) hooks
 * into this same form via its id, it does not replace it.
 *
 * next/form rather than a bare <form>: it prefetches /results (including its
 * loading.tsx) and submits as a client-side navigation, so the skeleton appears
 * immediately instead of the page sitting frozen while fn_search_results runs.
 * It degrades to a normal GET submit without JS.
 *
 * No province field: one office per province takes applications, so the
 * results are one card per province across Spain, ranked by where people
 * with these documents were accepted. Asking for a province first made
 * people choose before they could compare.
 */
export async function SearchForm({ documentTypes }: { documentTypes: DocumentTypeRow[] }) {
  const t = await getTranslations("home");
  const checklist = documentTypes.filter((d) => (CHECKLIST_DOCUMENT_CODES as readonly string[]).includes(d.code));

  return (
    <Form id="search-form" action="/results" className="flex flex-col gap-5">
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

      <SubmitButton
        label={t("searchButton")}
        pendingLabel={t("searchingLabel")}
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)]"
      />

      <MainButtonBridge formId="search-form" text={t("searchButton")} />
    </Form>
  );
}
