/**
 * One pass over the watched groups: read what is new since last time, keep
 * what is about temporary protection, store it for the scheduled Claude pass
 * that turns it into drafts. The owner hears from a run only when asked
 * (/watch_run) or when a group could not be read.
 *
 * Runs twice a day from the database's schedule (12:00 and 22:00 Madrid,
 * 0036) and on /watch_run.
 * Nothing goes to the site or the channel from here.
 */
import { createHash } from "node:crypto";
import type { Api } from "telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { callTelegram } from "@/lib/telegram/api";
import { getAdminBotToken, getModeratorChatId } from "@/lib/telegram/settings";
import { getApiCredentials, getSession, inputPeer, withClient, type SourcePeer } from "@/lib/chatwatch/telegram";
import { citiesIn, isRelevant } from "@/lib/chatwatch/relevance";
import { formatRunNotice, type FoundMessage } from "@/lib/chatwatch/digest";
import { collectPostViews } from "@/lib/channelStats";

interface SourceRow extends SourcePeer {
  id: number;
  title: string;
  username: string | null;
  topic: number | null;
  last_message_id: number | null;
}

/** A first read of a new source looks back this far. */
const FIRST_RUN_WINDOW_MS = 24 * 3600_000;
/** Leave room under the function's 60 s for sending the digest. */
const TIME_BUDGET_MS = 40_000;
const SEEN_TTL_DAYS = 30;

export type RunResult =
  | { status: "not_connected" }
  | { status: "no_sources" }
  | { status: "session_revoked" }
  | { status: "done"; found: number; hidden: number; sources: number; errors: number };

function fingerprint(text: string): string {
  return createHash("sha1").update(text.toLowerCase().split(/\s+/).join(" ")).digest("hex");
}

function messageLink(source: SourceRow, id: number): string {
  return source.username ? `https://t.me/${source.username}/${id}` : `https://t.me/c/${source.peer_id}/${id}`;
}

async function sendToOwner(texts: string[]): Promise<void> {
  const [token, chatId] = await Promise.all([getAdminBotToken(), getModeratorChatId()]);
  if (!token || !chatId) return;
  for (const text of texts) {
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    if (!res.ok) console.error("chat watch digest not sent:", res.description);
  }
}

export async function runChatWatch(options: { notifyWhenEmpty?: boolean } = {}): Promise<RunResult> {
  const [creds, session] = await Promise.all([getApiCredentials(), getSession()]);
  if (!creds || !session) return { status: "not_connected" };

  const admin = createAdminClient();
  const { data: rows } = await admin.from("chatwatch_sources").select("*").eq("enabled", true).order("id");
  const sources = (rows ?? []) as SourceRow[];
  if (sources.length === 0) return { status: "no_sources" };

  const started = Date.now();
  const found: (FoundMessage & { fp: string })[] = [];
  const errors: { title: string; error: string }[] = [];
  let hidden = 0;

  try {
    await withClient(session, creds, async (client) => {
      for (const source of sources) {
        if (Date.now() - started > TIME_BUDGET_MS) {
          errors.push({ title: source.title, error: "не встигли — буде наступного разу" });
          continue;
        }
        try {
          const messages = (await client.getMessages(inputPeer(source), {
            limit: source.last_message_id ? 1000 : 300,
            minId: source.last_message_id ?? 0,
            replyTo: source.topic ?? undefined,
          })) as unknown as Api.Message[];

          let maxId = source.last_message_id ?? 0;
          for (const m of messages) {
            maxId = Math.max(maxId, m.id);
            if (!source.last_message_id && m.date * 1000 < Date.now() - FIRST_RUN_WINDOW_MS) continue;
            const text = (m.message ?? "").trim();
            if (!text) continue;
            if (!isRelevant(text)) {
              hidden++;
              continue;
            }
            found.push({ sourceTitle: source.title, date: new Date(m.date * 1000), text, link: messageLink(source, m.id), fp: fingerprint(text) });
          }
          await admin
            .from("chatwatch_sources")
            .update({ last_message_id: maxId || null, last_run_at: new Date().toISOString(), last_error: null })
            .eq("id", source.id);
        } catch (err) {
          const message = (err as { errorMessage?: string }).errorMessage ?? String(err);
          if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|USER_DEACTIVATED/.test(message)) throw err;
          errors.push({ title: source.title, error: message });
          await admin.from("chatwatch_sources").update({ last_run_at: new Date().toISOString(), last_error: message }).eq("id", source.id);
        }
      }
      // While logged in anyway: how many people saw each channel post, for
      // the owner's statistics. Never at the cost of the digest.
      if (Date.now() - started < TIME_BUDGET_MS) {
        await collectPostViews(admin, client).catch((err) => console.error("channel views not read:", err));
      }
    });
  } catch (err) {
    const message = (err as { errorMessage?: string }).errorMessage ?? String(err);
    if (/AUTH_KEY_UNREGISTERED|SESSION_REVOKED|USER_DEACTIVATED/.test(message)) {
      await sendToOwner(["⚠️ <b>Сервер більше не підключений до Telegram</b> (сеанс завершено). Підключіть знову: /tg_login"]);
      return { status: "session_revoked" };
    }
    throw err;
  }

  // The same city summary is forwarded to several chats: once is enough.
  const unique = [...new Map(found.map((f) => [f.fp, f])).values()];
  let fresh = unique;
  if (unique.length > 0) {
    const { data: seen } = await admin
      .from("chatwatch_seen")
      .select("fingerprint")
      .in("fingerprint", unique.map((f) => f.fp));
    const seenSet = new Set((seen ?? []).map((s) => s.fingerprint as string));
    fresh = unique.filter((f) => !seenSet.has(f.fp));
    if (fresh.length > 0) {
      await admin.from("chatwatch_seen").upsert(fresh.map((f) => ({ fingerprint: f.fp })));
      // Kept for the scheduled Claude session that turns them into drafts
      // (see docs in supabase/migrations/0033).
      const { error } = await admin.from("chatwatch_found").insert(
        fresh.map((f) => ({
          source_title: f.sourceTitle,
          msg_date: f.date.toISOString(),
          text: f.text,
          link: f.link,
          cities: citiesIn(f.text),
        }))
      );
      if (error) console.error("chat watch: found messages not stored:", error.message);
    }
  }
  await admin
    .from("chatwatch_seen")
    .delete()
    .lt("seen_at", new Date(Date.now() - SEEN_TTL_DAYS * 86_400_000).toISOString());

  // Scheduled runs stay silent unless something is wrong: what they found
  // reaches the owner as ready drafts from the Claude pass at :05.
  if (errors.length > 0 || options.notifyWhenEmpty) {
    await sendToOwner([formatRunNotice({ found: fresh, sources: sources.length, hidden, errors, now: new Date() })]);
  }
  return { status: "done", found: fresh.length, hidden, sources: sources.length, errors: errors.length };
}
