import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LocationRow } from "@/lib/matching/types";
import { formatDate } from "@/lib/format";

function officialSourceLabel(
  t: Awaited<ReturnType<typeof getTranslations<"location">>>,
  location: LocationRow
): string {
  if (location.verification_status === "verified") return t("officialSourceMissm");
  if (location.verification_status === "conflict") return t("officialSourceConflict");
  if (location.verification_status === "user_submitted") return t("officialSourceUserSubmitted");
  if (location.verification_status === "community_reported") return t("officialSourceCommunity");
  return t("officialSourceOfficial2022");
}

export async function OfficialBlock({ location }: { location: LocationRow }) {
  const t = await getTranslations("location");
  const tMethod = await getTranslations("appointmentMethods");

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-2 font-medium">{t("officialBlockTitle")}</h2>

      {location.verification_status === "conflict" ? (
        <p role="alert" className="mb-2 rounded bg-[var(--highlight-bg)] p-2 text-sm">
          {t("verificationConflictNotice")}
        </p>
      ) : null}

      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="text-[var(--muted)]">{t("addressLabel")}</dt>
          <dd>
            {location.address ?? t("addressUnknown")}
            {location.address ? (
              <>
                {" — "}
                {/* Hands off to whatever maps app the phone has. Getting there
                    is the next thing anyone does with an address, and copying
                    it out by hand on a phone is miserable. */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${location.address}, ${location.city}`
                  )}`}
                  className="whitespace-nowrap underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("openInMaps")}
                </a>
              </>
            ) : null}
          </dd>
        </div>
        {location.phones.length > 0 ? (
          <div>
            <dt className="text-[var(--muted)]">{t("phoneLabel")}</dt>
            <dd className="flex flex-wrap gap-x-3">
              {location.phones.map((phone) => (
                // tel: needs the bare number; the stored value may be spaced
                // or bracketed for reading.
                <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="underline">
                  {phone}
                </a>
              ))}
            </dd>
          </div>
        ) : null}
        {location.email && !location.email_hidden ? (
          <div>
            <dt className="text-[var(--muted)]">{t("emailLabel")}</dt>
            <dd>
              <a href={`mailto:${location.email}`} className="underline">
                {location.email}
              </a>
            </dd>
          </div>
        ) : location.email_hidden ? (
          <div>
            <dt className="text-[var(--muted)]">{t("emailLabel")}</dt>
            <dd className="text-[var(--muted)]">{t("emailHiddenNote")}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[var(--muted)]">{t("appointmentMethodLabel")}</dt>
          <dd className="flex flex-col items-start gap-1.5">
            {tMethod(location.appointment_method)}
            {/* A button, not the raw URL: the booking site's address is long,
                opaque and the one thing on this card people actually tap. */}
            {location.appointment_url ? (
              <a
                href={location.appointment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-contrast)] no-underline"
              >
                {t("bookOnline")} ↗
              </a>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
        {officialSourceLabel(t, location)}
        {location.source_date ? ` (${location.source_date})` : ""}
        {" · "}
        {t("verifiedAtLabel")}: {formatDate(location.verified_at)}
        {" · "}
        <a href={location.source_url} className="underline" target="_blank" rel="noopener noreferrer">
          {t("sourceLabel")}
        </a>
      </p>

      {/* Right where the wrong detail is read — the first error a chat admin
          reported was on this card, and the only way to report it was a link
          further up in the community section. */}
      <Link href={`/locations/${location.id}/suggest`} className="mt-2 inline-block text-sm underline">
        {t("reportOfficialError")}
      </Link>
    </section>
  );
}
