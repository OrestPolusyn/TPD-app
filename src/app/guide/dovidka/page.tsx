import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GUIDE_AS_OF, guideCityGroups, guideIntro, guideSections } from "@/lib/guide";
import { formatDate } from "@/lib/format";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Довідка ДПСУ про перетин кордону — TP Spain",
  description: "Як отримати, як показувати в поліції і які відділки що вимагають: мокра печатка, присяжний переклад.",
};

export default async function CertificateGuidePage() {
  const t = await getTranslations("guide");
  const bot = config.telegramBotUsername();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {t("asOf", { date: formatDate(GUIDE_AS_OF) })} · {t("source")}
        </p>
      </div>

      <p className="text-sm">{guideIntro}</p>

      {guideSections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-1.5 font-medium">{section.title}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {section.points.map((point) => (
              <li key={point} className="flex gap-2 leading-snug">
                <span aria-hidden="true" className="text-[var(--muted)]">
                  •
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="mb-1.5 font-medium">{t("byOfficeTitle")}</h2>
        <div className="flex flex-col gap-3">
          {guideCityGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-[var(--shadow-sm)]"
            >
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{group.title}</h3>
              <ul className="flex flex-col gap-0.5">
                {group.cities.map((city) => (
                  <li key={city.locationId}>
                    <Link href={`/locations/${city.locationId}`} className="underline">
                      {city.label}
                    </Link>
                    {city.note ? <span className="text-[var(--muted)]"> — {city.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-3 text-sm">
        <p className="text-xs text-[var(--muted)]">{t("disclaimer")}</p>
        {bot ? (
          <a href={`https://t.me/${bot}?start=chg_guide`} className="underline" target="_blank" rel="noopener noreferrer">
            {t("suggest")}
          </a>
        ) : null}
      </div>
    </main>
  );
}
