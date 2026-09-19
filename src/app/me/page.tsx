import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { TelegramAuthPanel } from "@/components/auth/TelegramAuthPanel";
import { DeleteAccountButton } from "@/components/me/DeleteAccountButton";
import { getOwnReports, getOwnComments, getOwnSuggestions } from "@/lib/data/me";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface MePageProps {
  /** `?login=expired` comes from /auth/telegram when a chat link is stale. */
  searchParams: Promise<{ login?: string }>;
}

export default async function MePage({ searchParams }: MePageProps) {
  const { login } = await searchParams;
  const t = await getTranslations("auth");
  const tMe = await getTranslations("me");
  const tCommon = await getTranslations("common");
  const tOutcomes = await getTranslations("outcomes");
  const tSuggest = await getTranslations("suggestForm");
  const suggestionFieldLabels: Record<string, string> = {
    address: tSuggest("fieldAddress"),
    postal_code: tSuggest("fieldPostalCode"),
    phone: tSuggest("fieldPhone"),
    appointment_url: tSuggest("fieldAppointmentUrl"),
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const botUsername = config.telegramBotUsername();
    const devLoginEnabled = config.devLoginEnabled();

    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h1>
        <p className="text-sm text-[var(--muted)]">{t("loginHint")}</p>
        <p className="text-sm text-[var(--muted)]">{t("loginTroubleshooting")}</p>
        <TelegramAuthPanel
          botUsername={botUsername}
          linkExpired={login === "expired" || login === "failed"}
          labels={{
            checking: t("telegramChecking"),
            openBot: t("openBotButton"),
            openBotHint: t("openBotHint"),
            linkExpired: t("loginLinkExpired"),
            badHash: t("telegramBadHash"),
            expired: t("sessionExpired"),
            otherFailure: t("telegramOtherFailure"),
            reopen: t("reopenApp"),
          }}
        />
        {devLoginEnabled ? (
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
            <a href="/api/auth/dev?user=1" className="underline">
              {t("devLoginUser1")}
            </a>
            <a href="/api/auth/dev?user=2" className="underline">
              {t("devLoginUser2")}
            </a>
          </div>
        ) : null}
      </main>
    );
  }

  const [reports, comments, suggestions] = await Promise.all([
    getOwnReports(supabase, user.id),
    getOwnComments(supabase, user.id),
    getOwnSuggestions(supabase, user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{tMe("title")}</h1>

      <section>
        <h2 className="mb-2 font-medium">{tMe("myReportsTitle")}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{tMe("noItems")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {reports.map((r) => (
              <li key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <a href={`/locations/${r.location_id}#report-${r.id}`} className="underline">
                  {formatDate(r.event_date)}
                </a>
                <span className="ml-2 text-[var(--muted)]">{tOutcomes(r.outcome as Parameters<typeof tOutcomes>[0])}</span>
                <span className="ml-2 text-xs text-[var(--muted)]">{tMe(`moderationStatus.${r.moderation_status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">{tMe("myCommentsTitle")}</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{tMe("noItems")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="whitespace-pre-wrap">{c.body}</p>
                <span className="text-xs text-[var(--muted)]">{tMe(`moderationStatus.${c.moderation_status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">{tMe("mySuggestionsTitle")}</h2>
        {suggestions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{tMe("noItems")}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {suggestions.map((s) => (
              <li key={s.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p>
                  {suggestionFieldLabels[s.field] ?? s.field}: <span className="line-through">{s.current_value ?? "—"}</span> → {s.proposed_value}
                </p>
                <span className="text-xs text-[var(--muted)]">{tMe(`moderationStatus.${s.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-[var(--border)] pt-4">
        <DeleteAccountButton
          labels={{
            button: tMe("deleteAccountButton"),
            confirmTitle: tMe("deleteAccountConfirmTitle"),
            confirmBody: tMe("deleteAccountConfirmBody"),
            confirmButton: tMe("deleteAccountConfirmButton"),
            cancel: tCommon("cancel"),
            success: tMe("deleteAccountSuccess"),
            generic: tCommon("errorGeneric"),
          }}
        />
      </section>
    </main>
  );
}
