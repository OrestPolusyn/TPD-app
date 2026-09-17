"use client";

import { useEffect, useRef, useState } from "react";

interface TelegramLoginUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTpSpainTelegramAuth?: (user: TelegramLoginUser) => void;
  }
}

/**
 * Renders the official Telegram Login Widget (a <script> tag Telegram
 * replaces with its own iframe button) and posts the resulting payload to
 * /api/auth/telegram for server-side validation, per
 * https://core.telegram.org/widgets/login
 */
export function TelegramLoginWidget({
  botUsername,
  labels,
  onResult,
}: {
  botUsername: string;
  labels: { failed: string };
  onResult?: (ok: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.onTpSpainTelegramAuth = async (user: TelegramLoginUser) => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginWidget: user }),
        });
        if (!res.ok) throw new Error("auth_failed");
        onResult?.(true);
        window.location.reload();
      } catch {
        setError(true);
        onResult?.(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTpSpainTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTpSpainTelegramAuth;
    };
  }, [botUsername, onResult]);

  return (
    <div>
      <div ref={containerRef} />
      {error ? <p className="mt-2 text-sm text-red-600">{labels.failed}</p> : null}
    </div>
  );
}
