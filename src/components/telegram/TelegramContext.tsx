"use client";

import { createContext, useContext } from "react";
import type { TelegramWebApp } from "@/types/telegram-web-app";

/** Why the Mini App's silent login ended the way it did, for /me to explain. */
export type TelegramAuthState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "ok" }
  | { status: "failed"; reason: string };

export interface TelegramContextValue {
  isTelegram: boolean;
  webApp: TelegramWebApp | null;
  auth: TelegramAuthState;
}

export const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  webApp: null,
  auth: { status: "idle" },
});

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
