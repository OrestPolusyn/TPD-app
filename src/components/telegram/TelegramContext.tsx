"use client";

import { createContext, useContext } from "react";
import type { TelegramWebApp } from "@/types/telegram-web-app";

export interface TelegramContextValue {
  isTelegram: boolean;
  webApp: TelegramWebApp | null;
}

export const TelegramContext = createContext<TelegramContextValue>({ isTelegram: false, webApp: null });

export function useTelegram(): TelegramContextValue {
  return useContext(TelegramContext);
}
