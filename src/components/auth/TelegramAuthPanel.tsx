"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/components/telegram/TelegramContext";
import { Spinner } from "@/components/shared/Spinner";

const POLL_INTERVAL_MS = 2_000;
/** Matches the request's own 10-minute TTL closely enough; the server decides. */
const POLL_WINDOW_MS = 5 * 60_000;

type PollStatus = "none" | "pending" | "signed_in" | "expired" | "failed";

interface PollResponse {
  status: PollStatus;
  code?: string;
}

export interface TelegramAuthPanelLabels {
  /** Shown while the Mini App exchanges initData for a session. */
  checking: string;
  /** Opens the bot, which asks for confirmation. */
  openBot: string;
  /** Explains what tapping that button will do. */
  openBotHint: string;
  /** Polling: the confirmation has not arrived yet. */
  waiting: string;
  /** Heading above the pairing code. */
  codeLabel: string;
  /** Tells the person to confirm only on a matching code. */
  codeHint: string;
  /** Nobody confirmed within the window. */
  timedOut: string;
  /** /api/auth/telegram/start could not mint a request. */
  startFailed: string;
  /** Start over after a timeout. */
  retry: string;
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
 * In a browser: the bot confirms, this page signs in. See BrowserLogin below.
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
  startFailed,
  labels,
}: {
  botUsername: string | null;
  /** True when a previous start attempt bounced back to /me. */
  startFailed?: boolean;
  labels: TelegramAuthPanelLabels;
}) {
  const { isTelegram, auth, webApp } = useTelegram();

  if (!isTelegram) {
    if (!botUsername) return null;
    return <BrowserLogin startFailed={startFailed} labels={labels} />;
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
        <p className="text-sm text-[var(--danger)]">{explanation}</p>
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

/**
 * Sign-in from an ordinary browser, without ever handing the session to
 * another one.
 *
 * The bot used to send a login link into the chat. On a phone, tapping a link
 * in Telegram opens Telegram's own in-app browser, so the session was created
 * in a WebView the person was not browsing from — their real browser stayed
 * signed out, with no way to fix it from there.
 *
 * So the direction is reversed: /api/auth/telegram/start puts a secret in
 * *this* browser's cookie and sends the person to the bot with only a public
 * request id; the bot asks them to confirm; and this page polls until the
 * approval lands, creating the session here. The chat never carries a session,
 * so it no longer matters which browser it would have opened.
 */
function BrowserLogin({ startFailed, labels }: { startFailed?: boolean; labels: TelegramAuthPanelLabels }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "waiting" | "timedOut" | "failed">(startFailed ? "failed" : "idle");
  const [code, setCode] = useState<string | null>(null);

  /** One check. Answers whether it is still worth polling. */
  const poll = useCallback(async (): Promise<boolean> => {
    let body: PollResponse;
    try {
      const res = await fetch("/api/auth/telegram/poll", { method: "POST" });
      body = (await res.json()) as PollResponse;
    } catch {
      // A request dropped while the OS was switching apps is normal here.
      return true;
    }

    switch (body.status) {
      case "signed_in":
        router.refresh();
        return false;
      case "pending":
        setCode(body.code ?? null);
        setPhase("waiting");
        return true;
      case "expired":
        setPhase("timedOut");
        return false;
      case "failed":
        setPhase("failed");
        return false;
      default:
        return false; // "none" — nothing was started from this browser
    }
  }, [router]);

  useEffect(() => {
    // Nothing left to wait for, and re-checking could drag a timed-out panel
    // back into "waiting" on a request the server still considers alive.
    if (phase === "timedOut" || phase === "failed") return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + POLL_WINDOW_MS;

    const tick = async () => {
      if (stopped) return;
      const keepGoing = await poll();
      if (stopped || !keepGoing) return;
      if (Date.now() > deadline) {
        setPhase("timedOut");
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Coming back from Telegram is the moment this has to land, and a
    // backgrounded tab's timers are throttled to the point of uselessness.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };

    // The first check runs on a timer rather than inline, so a mount with
    // nothing to poll for does not cascade a render and cleanup can cancel it.
    // It also covers a request started in another tab, or before a reload —
    // the cookie is what matters, not the tab that set it.
    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, poll]);

  return (
    <div className="flex w-full flex-col items-start gap-3">
      {phase === "failed" ? <p className="text-sm text-[var(--danger)]">{labels.startFailed}</p> : null}
      {phase === "timedOut" ? <p className="text-sm text-[var(--danger)]">{labels.timedOut}</p> : null}

      <a
        href="/api/auth/telegram/start"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setCode(null);
          setPhase("waiting");
        }}
        className="rounded-full border border-[var(--accent)] px-4 py-2 font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
      >
        {phase === "waiting" || phase === "timedOut" ? labels.retry : labels.openBot}
      </a>

      {phase === "waiting" ? (
        <div className="flex w-full flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Spinner />
            {labels.waiting}
          </p>
          {code ? (
            <>
              <p className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">{labels.codeLabel}</p>
              <p className="text-3xl font-bold tracking-[0.3em] tabular-nums">{code}</p>
              <p className="text-xs text-[var(--muted)]">{labels.codeHint}</p>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">{labels.openBotHint}</p>
      )}
    </div>
  );
}
