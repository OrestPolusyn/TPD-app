import { getTranslations } from "next-intl/server";
import { getUpdatesChannel } from "@/lib/telegram/settings";

/** "@name" → https://t.me/name; null for a private channel (-100…) or none. */
export async function getChannelLink(): Promise<{ name: string; url: string } | null> {
  const channel = await getUpdatesChannel();
  if (!channel?.startsWith("@")) return null;
  return { name: channel, url: `https://t.me/${channel.slice(1)}` };
}

/**
 * The news that the site has a Telegram channel: rule changes and new
 * reports arrive there the moment they are confirmed, which the site alone
 * cannot do — nobody refreshes an office page every day.
 */
export async function ChannelNews() {
  const link = await getChannelLink();
  if (!link) return null;
  const t = await getTranslations("channelNews");

  return (
    <section
      aria-labelledby="channel-news-title"
      className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--highlight-border)] bg-[var(--highlight-bg)] p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t("label")}</p>
        <h2 id="channel-news-title" className="mt-0.5 font-medium">
          📢 {t("title")}
        </h2>
        <p className="mt-1 leading-snug text-[var(--muted)]">{t("body")}</p>
      </div>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 self-start rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90 sm:self-center"
      >
        {t("cta", { channel: link.name })}
      </a>
    </section>
  );
}
