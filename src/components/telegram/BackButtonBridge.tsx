"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTelegram } from "./TelegramContext";

/** Shows Telegram's native BackButton on every route except "/", hidden there. */
export function BackButtonBridge() {
  const { isTelegram, webApp } = useTelegram();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isTelegram || !webApp) return;
    const isRoot = pathname === "/";

    if (isRoot) {
      webApp.BackButton.hide();
      return;
    }

    const handleClick = () => router.back();
    webApp.BackButton.onClick(handleClick);
    webApp.BackButton.show();

    return () => {
      webApp.BackButton.offClick(handleClick);
    };
  }, [isTelegram, webApp, pathname, router]);

  return null;
}
