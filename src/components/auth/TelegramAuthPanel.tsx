"use client";

import { useTelegram } from "@/components/telegram/TelegramContext";
import { Spinner } from "@/components/shared/Spinner";

export interface TelegramAuthPanelLabels {
  /** Shown while the Mini App exchanges initData for a session. */
  checking: string;
  /** Opens the bot, which replies with a one-time login link. */
  openBot: string;
  /** Explains what tapping that button will do. */
  openBotHint: string;
  /** The link in the chat had expired or was already used. */
  linkExpired: string;
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
 * In a browser: a link to the bot, which replies with a one-time login link.
 * The Telegram Login Widget used to live here and was replaced — it requires
 * BotFather's /setdomain, an account action the deployment cannot perform, and
 * until it is done the widget renders nothing but "Bot domain invalid" at every
 * visitor. Going through the bot needs no BotFather step at all.
 *
 * Inside Telegram: the Mini App's silent login is the mechanism, and the widget
 * could not have rendered there anyway — telegram.org's script refuses inside
 * Telegram's own WebView, which left /me a blank dead end.
 */
export function TelegramAuthPanel({
  botUsername,
  linkExpired,
  labels,
}: {
  botUsername: string | null;
  /** True when the visitor arrived from a stale link in the chat. */
  linkExpired?: boolean;
  labels: TelegramAuthPanelLabels;
}) {
  const { isTelegram, auth, webApp } = useTelegram();

  if (!isTelegram) {
    if (!botUsername) return null;
    return (
      <div className="flex flex-col items-start gap-2">
        {linkExpired ? <p className="text-sm text-red-500">{labels.linkExpired}</p> : null}
        <a
          href={`https://t.me/${botUsername}?start=login`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[var(--accent)] px-4 py-2 font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          {labels.openBot}
        </a>
        <p className="text-sm text-[var(--muted)]">{labels.openBotHint}</p>
      </div>
    );
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
