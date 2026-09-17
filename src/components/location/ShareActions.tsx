"use client";

import { useState } from "react";

export function ShareActions({
  webUrl,
  telegramUrl,
  labels,
}: {
  webUrl: string;
  telegramUrl: string | null;
  /** Pre-translated strings from the server parent — avoids shipping the
   * next-intl client runtime just for three short button labels. */
  labels: { copyLink: string; copySuccess: string; openTelegram: string };
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(webUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — link is still visible in the address bar
    }
  }

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <button type="button" onClick={copyLink} className="underline">
        {copied ? labels.copySuccess : labels.copyLink}
      </button>
      {telegramUrl ? (
        <a href={telegramUrl} className="underline">
          {labels.openTelegram}
        </a>
      ) : null}
    </div>
  );
}
