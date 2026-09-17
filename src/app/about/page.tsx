import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";
import { config } from "@/lib/config";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const officialInfoUrl = config.officialInfoUrl();

  let legalNotice = "";
  try {
    legalNotice = await readFile(path.join(process.cwd(), "content", "legal-notice.uk.md"), "utf8");
  } catch {
    legalNotice = "";
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <section>
        <h2 className="mb-1 font-medium">{t("disclaimerTitle")}</h2>
        <p className="text-sm">{t("disclaimerBody")}</p>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("sourcesTitle")}</h2>
        <ul className="list-inside list-disc text-sm">
          <li>
            <a href="https://www.interior.gob.es" target="_blank" rel="noopener noreferrer" className="underline">
              {t("sourceInteriorMinistry")}
            </a>
          </li>
          {officialInfoUrl ? (
            <li>
              <a href={officialInfoUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {officialInfoUrl}
              </a>
            </li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 font-medium">{t("legalNoticeTitle")}</h2>
        <div className="whitespace-pre-wrap text-sm">{legalNotice}</div>
      </section>
    </main>
  );
}
