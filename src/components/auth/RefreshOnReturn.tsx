"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches this Server Component tree when the tab regains focus.
 *
 * Signing in from a browser means leaving to Telegram to tap the bot's login
 * link, which opens the link in a new tab and signs that tab in — this one,
 * the one the visitor started from, stays on the signed-out render until
 * something refreshes it. Coming back to it (switching tabs, or the OS
 * bringing the browser forward) now updates it without a manual reload.
 *
 * Mounted only on the signed-out branch of /me, so it stops polling anything
 * once signed in.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    // pageshow also fires when the page is restored from the back/forward
    // cache, which visibilitychange does not reliably cover on iOS Safari.
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [router]);

  return null;
}
