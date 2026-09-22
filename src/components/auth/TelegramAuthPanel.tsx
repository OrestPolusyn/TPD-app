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
  labels,
}: {
  botUsername: string | null;
  labels: TelegramAuthPanelLabels;
}) {
  const { isTelegram, auth, webApp } = useTelegram();

  if (!isTelegram) {
    if (!botUsername) return null;
    return <BrowserLogin labels={labels} />;
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
function BrowserLogin({ labels }: { labels: TelegramAuthPanelLabels }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"starting" | "ready" | "waiting" | "timedOut" | "failed">("starting");
  const [request, setRequest] = useState<{ deepLink: string; code: string } | null>(null);

  /**
   * Asks for the link to the bot. The request is minted here rather than
   * behind the button so that the button can be a plain <a href="https://t.me/…">:
   * a direct tap on a t.me address hands over to the Telegram app and leaves
   * this page in place, where a redirect would have cost either an abandoned
   * tab or the page that is waiting for the confirmation.
   */
  const start = useCallback(async () => {
    setPhase("starting");
    try {
      const res = await fetch("/api/auth/telegram/start", { method: "POST" });
      if (!res.ok) {
        setPhase("failed");
        return;
      }
      const body = (await res.json()) as { deepLink: string; code: string; resumed: boolean };
      setRequest({ deepLink: body.deepLink, code: body.code });
      // Resumed means the bot was already asked and may already have been
      // answered — including while this page was gone, if the browser dropped
      // it and reloaded on the way back.
      setPhase(body.resumed ? "waiting" : "ready");
    } catch {
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void start(), 0);
    return () => clearTimeout(timer);
  }, [start]);

  const poll = useCallback(async (): Promise<PollStatus | null> => {
    try {
      const res = await fetch("/api/auth/telegram/poll", { method: "POST" });
      return ((await res.json()) as PollResponse).status;
    } catch {
      // A request dropped while the OS was switching apps is normal here.
      return null;
    }
  }, []);

  useEffect(() => {
    if (phase !== "waiting") return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + POLL_WINDOW_MS;

    const tick = async () => {
      if (stopped) return;
      const status = await poll();
      if (stopped) return;

      if (status === "signed_in") {
        router.refresh();
        return;
      }
      if (status === "expired" || status === "none") {
        setPhase("timedOut");
        return;
      }
      if (status === "failed") {
        setPhase("failed");
        return;
      }
      // "pending", or null from a dropped request: keep waiting.
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

    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, poll, router]);

  if (phase === "starting") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Spinner />
      </p>
    );
  }

  if (phase === "failed" || !request) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[var(--danger)]">{labels.startFailed}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="rounded-full border border-[var(--accent)] px-4 py-2 font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          {labels.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-start gap-3">
      {phase === "timedOut" ? <p className="text-sm text-[var(--danger)]">{labels.timedOut}</p> : null}

      <a
        href={request.deepLink}
        onClick={(event) => {
          setPhase("waiting");
          // Desktop and phone need opposite things here, and getting it wrong
          // breaks the login either way.
          //
          // On a phone the OS hands a t.me address to the Telegram app and
          // this page stays exactly where it is — a new tab would just be
          // litter left behind (which is what it was, before).
          //
          // A desktop browser has no app to hand to: it navigates this tab to
          // t.me, taking with it the page that is waiting for the
          // confirmation, so the login can never complete. There it opens in
          // its own tab and this one keeps polling.
          if (window.matchMedia("(pointer: coarse)").matches) return;
          event.preventDefault();
          window.open(request.deepLink, "_blank", "noopener");
        }}
        className="rounded-full border border-[var(--accent)] px-4 py-2 font-medium text-[var(--accent)] no-underline transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
      >
        {phase === "ready" ? labels.openBot : labels.retry}
      </a>

      <div className="flex w-full flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
        {phase === "waiting" ? (
          <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Spinner />
            {labels.waiting}
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">{labels.openBotHint}</p>
        )}
        <p className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">{labels.codeLabel}</p>
        <p className="text-3xl font-bold tracking-[0.3em] tabular-nums">{request.code}</p>
        <p className="text-xs text-[var(--muted)]">{labels.codeHint}</p>
      </div>
    </div>
  );
}
