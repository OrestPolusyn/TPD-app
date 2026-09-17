import { getTranslations } from "next-intl/server";
import type { LocationRow } from "@/lib/matching/types";
import { formatDate } from "@/lib/format";

function officialSourceLabel(
  t: Awaited<ReturnType<typeof getTranslations<"location">>>,
  location: LocationRow
): string {
  if (location.verification_status === "verified") return t("officialSourceCreade");
  if (location.verification_status === "conflict") return t("officialSourceConflict");
  return t("officialSourceOfficial2022");
}

export async function OfficialBlock({ location }: { location: LocationRow }) {
  const t = await getTranslations("location");
  const tMethod = await getTranslations("appointmentMethods");

  return (
    <section className="rounded-md border border-[var(--border)] p-4">
      <h2 className="mb-2 font-medium">{t("officialBlockTitle")}</h2>

      {location.verification_status === "conflict" ? (
        <p role="alert" className="mb-2 rounded bg-[var(--highlight-bg)] p-2 text-sm">
          {t("verificationConflictNotice")}
        </p>
      ) : null}

      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="text-[var(--muted)]">{t("addressLabel")}</dt>
          <dd>{location.address ?? t("addressUnknown")}</dd>
        </div>
        {location.phones.length > 0 ? (
          <div>
            <dt className="text-[var(--muted)]">{t("phoneLabel")}</dt>
            <dd>{location.phones.join(", ")}</dd>
          </div>
        ) : null}
        {location.email && !location.email_hidden ? (
          <div>
            <dt className="text-[var(--muted)]">{t("emailLabel")}</dt>
            <dd>{location.email}</dd>
          </div>
        ) : location.email_hidden ? (
          <div>
            <dt className="text-[var(--muted)]">{t("emailLabel")}</dt>
            <dd className="text-[var(--muted)]">{t("emailHiddenNote")}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[var(--muted)]">{t("appointmentMethodLabel")}</dt>
          <dd>
            {tMethod(location.appointment_method)}
            {location.appointment_url ? (
              <>
                {" — "}
                <a href={location.appointment_url} className="underline" target="_blank" rel="noopener noreferrer">
                  {location.appointment_url}
                </a>
              </>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t("sourceLabel")}</dt>
          <dd>
            {officialSourceLabel(t, location)}
            {location.source_date ? ` (${location.source_date})` : ""}
            {" — "}
            <a href={location.source_url} className="underline" target="_blank" rel="noopener noreferrer">
              {t("officialBlockTitle")}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">{t("verifiedAtLabel")}</dt>
          <dd>{formatDate(location.verified_at)}</dd>
        </div>
      </dl>
    </section>
  );
}
