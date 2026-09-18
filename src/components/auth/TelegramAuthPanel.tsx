"use client";

import { useTelegram } from "@/components/telegram/TelegramContext";
import { TelegramLoginWidget } from "@/components/auth/TelegramLoginWidget";
import { Spinner } from "@/components/shared/Spinner";

export interface TelegramAuthPanelLabels {
  /** Shown while the Mini App exchanges initData for a session. */
  checking: string;
  /** Web Login Widget POST failed. */
  failed: string;
  /** initData rejected: almost always the Mini App and the server's bot token differ. */
  badHash: string;
  /** initData older than the 24h freshness window. */
  expired: string;
  /** Anything else, with the raw reason appended for the admin. */
  otherFailure: string;
  reopen: string;
}

/**
 * Picks the right sign-in affordance for where the app is actually running.
 *
 * Inside Telegram the web Login Widget cannot render at all — telegram.org's
 * script refuses inside Telegram's own WebView — so /me used to show a heading,
 * a hint and a blank space with no way forward and no explanation. There the
 * Mini App's silent login is the mechanism, and this reports its outcome.
 */
export function TelegramAuthPanel({
  botUsername,
  labels,
}: {
  botUsername: string | null;
  labels: TelegramAuthPanelLabels;
}) {
  const { isTelegram, auth, webApp } = useTelegram();

  if (!isTelegram) {
    return botUsername ? <TelegramLoginWidget botUsername={botUsername} labels={{ failed: labels.failed }} /> : null;
  }

  if (auth.status === "pending" || auth.status === "idle") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Spinner />
        {labels.checking}
      </p>
    );
  }

  if (auth.status === "failed") {
    const explanation =
      auth.reason === "bad_hash"
        ? labels.badHash
        : auth.reason === "expired"
          ? labels.expired
          : `${labels.otherFailure} (${auth.reason})`;
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-red-500">{explanation}</p>
        <button
          type="button"
          onClick={() => webApp?.close()}
          className="rounded-full border border-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent)]"
        >
          {labels.reopen}
        </button>
      </div>
    );
  }

  return null; // signed in; router.refresh() re-renders this page as authenticated
}
