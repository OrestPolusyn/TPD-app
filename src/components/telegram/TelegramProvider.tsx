"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TelegramContext } from "./TelegramContext";
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

  useEffect(() => {
    function init(app: TelegramWebApp) {
      if (!app.initData) return; // opened in a plain browser, e.g. someone hit t.me link's web fallback
      app.ready();
      app.expand();
      applyTheme(app);
      app.onEvent("themeChanged", () => applyTheme(app));
      setWebApp(app);

      fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: app.initData }),
      }).catch(() => {
        // Silent login is a convenience, not a hard requirement — browsing
        // works regardless, and write actions will prompt login explicitly.
      });

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

  return <TelegramContext value={{ isTelegram: webApp !== null, webApp }}>{children}</TelegramContext>;
}
