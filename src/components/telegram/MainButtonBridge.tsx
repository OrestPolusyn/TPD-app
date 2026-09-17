"use client";

import { useEffect } from "react";
import { useTelegram } from "./TelegramContext";

/**
 * Inside Telegram: hides the in-page submit button of `formId` and drives
 * Telegram's native MainButton instead, mirroring the in-page button's
 * `disabled` state (set while a request is in flight) onto MainButton's
 * enable/disable + progress spinner. Outside Telegram this renders nothing
 * and the normal in-page button is used, per docs/SPEC.md.
 */
export function MainButtonBridge({ formId, text }: { formId: string; text: string }) {
  const { isTelegram, webApp } = useTelegram();

  useEffect(() => {
    if (!isTelegram || !webApp) return;
    const form = document.getElementById(formId);
    const submitButton = form?.querySelector('button[type="submit"]');
    if (!(form instanceof HTMLFormElement) || !(submitButton instanceof HTMLButtonElement)) return;

    submitButton.style.display = "none";
    webApp.MainButton.setText(text);
    webApp.MainButton.show();

    const handleClick = () => form.requestSubmit();
    webApp.MainButton.onClick(handleClick);

    const syncState = () => {
      if (submitButton.disabled) {
        webApp.MainButton.disable();
        webApp.MainButton.showProgress(true);
      } else {
        webApp.MainButton.enable();
        webApp.MainButton.hideProgress();
      }
    };
    syncState();
    const observer = new MutationObserver(syncState);
    observer.observe(submitButton, { attributes: true, attributeFilter: ["disabled"] });

    return () => {
      webApp.MainButton.offClick(handleClick);
      webApp.MainButton.hide();
      observer.disconnect();
      submitButton.style.display = "";
    };
  }, [isTelegram, webApp, formId, text]);

  return null;
}
