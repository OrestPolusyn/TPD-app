"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramContext, type TelegramAuthState } from "./TelegramContext";
import type { TelegramWebApp } from "@/types/telegram-web-app";

const START_PARAM_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

/** startapp=loc_<id> -> /locations/<id>; startapp=search_<slug> -> /results?province=<slug>.
 * Anything else (including a param that fails the regex) resolves to null,
 * meaning "ignore it, stay on /", per docs/SPEC.md. */
export function resolveDeepLink(startParam: string | undefined): string | null {
  if (!startParam || !START_PARAM_REGEX.test(startParam)) return null;
  if (startParam.startsWith("loc_")) {
    const id = startParam.slice("loc_".length);
    return id ? `/locations/${id}` : null;
  }
  if (startParam.startsWith("search_")) {
    const slug = startParam.slice("search_".length);
    return slug ? `/results?province=${slug}` : null;
  }
  return null;
}

function applyTheme(webApp: TelegramWebApp) {
  const root = document.documentElement;
  root.setAttribute("data-tg-theme", webApp.colorScheme);
  const tp = webApp.themeParams;
  if (tp.bg_color) root.style.setProperty("--background", tp.bg_color);
  if (tp.text_color) root.style.setProperty("--foreground", tp.text_color);
  if (tp.hint_color) root.style.setProperty("--muted", tp.hint_color);
  if (tp.button_color) root.style.setProperty("--accent", tp.button_color);
  if (tp.button_text_color) root.style.setProperty("--accent-contrast", tp.button_text_color);
  if (tp.secondary_bg_color) root.style.setProperty("--border", tp.secondary_bg_color);
}

/**
 * Detects whether we're running inside the Telegram Mini App (by the
 * presence of window.Telegram.WebApp.initData), and if so: calls
 * ready()/expand(), maps themeParams to CSS variables, silently exchanges
 * initData for a Supabase session, and follows a valid startapp deep link.
 * Outside Telegram this renders nothing extra — pages fall back to normal
 * in-page buttons and browser navigation.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [auth, setAuth] = useState<TelegramAuthState>({ status: "idle" });

  useEffect(() => {
    function init(app: TelegramWebApp) {
      if (!app.initData) return; // opened in a plain browser, e.g. someone hit t.me link's web fallback
      app.ready();
      app.expand();
      applyTheme(app);
      app.onEvent("themeChanged", () => applyTheme(app));
      setWebApp(app);

      // Browsing works without this, but the outcome is recorded rather than
      // swallowed: a 401 is a resolved fetch, not a rejection, so the old
      // `.catch(() => {})` hid every rejected initData. That left /me showing a
      // login screen inside Telegram with no button (the web widget cannot
      // render in Telegram's WebView) and no reason — a dead end.
      setAuth({ status: "pending" });
      void (async () => {
        try {
          const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: app.initData }),
          });
          if (res.ok) {
            setAuth({ status: "ok" });
            // The server already rendered this page as signed-out; the session
            // cookie only exists now, so re-fetch it.
            router.refresh();
            return;
          }
          const body: unknown = await res.json().catch(() => null);
          const reason =
            body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
              ? (body as { error: string }).error
              : `http_${res.status}`;
          setAuth({ status: "failed", reason });
        } catch {
          setAuth({ status: "failed", reason: "network" });
        }
      })();

      const target = resolveDeepLink(app.initDataUnsafe.start_param);
      if (target) router.replace(target);
    }

    if (window.Telegram?.WebApp) {
      init(window.Telegram.WebApp);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => {
      if (window.Telegram?.WebApp) init(window.Telegram.WebApp);
    };
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount by design
  }, []);

  return <TelegramContext value={{ isTelegram: webApp !== null, webApp, auth }}>{children}</TelegramContext>;
}
