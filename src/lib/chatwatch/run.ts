/**
 * One pass over the watched groups: read what is new since last time, keep
 * what is about temporary protection, store it for the scheduled Claude pass
 * that turns it into drafts. The owner hears from a run only when asked
 * (/watch_run) or when a group could not be read.
 *
 * Runs four times a day from the database's schedule (07:00, 12:00, 17:00 and
 * 22:00 Madrid, 0038) and on /watch_run.
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
/** How much of the answered message is kept as context. */
const REPLY_TEXT_MAX = 600;
/** Answered messages fetched per source when they are not in the batch read. */
const REPLY_FETCH_MAX = 40;

/** A found message, with what it answers (when it is a reply). */
type Found = FoundMessage & { fp: string; replyText?: string };

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

/**
 * The id of the message `m` answers, or null. In a forum a plain post
 * "answers" its topic's first message — that is not a reply.
 */
function replyTargetId(m: Api.Message, topic: number | null): number | null {
  const r = m.replyTo;
  if (!r || !("replyToMsgId" in r) || !r.replyToMsgId) return null;
  if (r.forumTopic && !r.replyToTopId) return null;
  if (topic && r.replyToMsgId === topic) return null;
  return r.replyToMsgId;
}

/**
 * Keeps what is new for the scheduled Claude pass (see 0033); returns it.
 * The same city summary is forwarded to several chats: once is enough.
 */
async function storeFound(
  admin: ReturnType<typeof createAdminClient>,
  found: Found[]
): Promise<Found[]> {
  const unique = [...new Map(found.map((f) => [f.fp, f])).values()];
  if (unique.length === 0) return [];
  const { data: seen } = await admin
    .from("chatwatch_seen")
    .select("fingerprint")
    .in("fingerprint", unique.map((f) => f.fp));
  const seenSet = new Set((seen ?? []).map((s) => s.fingerprint as string));
  const fresh = unique.filter((f) => !seenSet.has(f.fp));
  if (fresh.length === 0) return [];
  const { error } = await admin.from("chatwatch_found").insert(
    fresh.map((f) => ({
      source_title: f.sourceTitle,
      msg_date: f.date.toISOString(),
      text: f.text,
      link: f.link,
      // The answered message often names the city the reply leaves out.
      cities: citiesIn(f.replyText ? `${f.text}\n${f.replyText}` : f.text),
      reply_text: f.replyText ?? null,
    }))
  );
  if (error) {
    console.error("chat watch: found messages not stored:", error.message);
    return [];
  }
  // Marked seen only once stored, so a failed insert is retried next time.
  await admin.from("chatwatch_seen").upsert(fresh.map((f) => ({ fingerprint: f.fp })));
  return fresh;
}

export async function runChatWatch(options: { notifyWhenEmpty?: boolean } = {}): Promise<RunResult> {
  const [creds, session] = await Promise.all([getApiCredentials(), getSession()]);
  if (!creds || !session) return { status: "not_connected" };

  const admin = createAdminClient();
  const { data: rows } = await admin.from("chatwatch_sources").select("*").eq("enabled", true).order("id");
  const sources = (rows ?? []) as SourceRow[];
  if (sources.length === 0) return { status: "no_sources" };

  const started = Date.now();
  const found: Found[] = [];
  const errors: { title: string; error: string }[] = [];
  let hidden = 0;
  let fresh: Found[] = [];

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
          const texts = new Map(messages.map((m) => [m.id, (m.message ?? "").trim()]));
          const replies: { item: Found; to: number }[] = [];
          for (const m of messages) {
            maxId = Math.max(maxId, m.id);
            if (!source.last_message_id && m.date * 1000 < Date.now() - FIRST_RUN_WINDOW_MS) continue;
            const text = (m.message ?? "").trim();
            if (!text) continue;
            if (!isRelevant(text)) {
              hidden++;
              continue;
            }
            const item: Found = { sourceTitle: source.title, date: new Date(m.date * 1000), text, link: messageLink(source, m.id), fp: fingerprint(text) };
            found.push(item);
            const to = replyTargetId(m, source.topic);
            if (to) replies.push({ item, to });
          }
          // What each reply answers: from this batch when it is there, else
          // read by id. Context only — never at the cost of the messages.
          const missing = [...new Set(replies.filter((r) => !texts.has(r.to)).map((r) => r.to))].slice(0, REPLY_FETCH_MAX);
          if (missing.length > 0 && Date.now() - started < TIME_BUDGET_MS) {
            try {
              const answered = (await client.getMessages(inputPeer(source), { ids: missing })) as unknown as (Api.Message | undefined)[];
              for (const a of answered) if (a && typeof a.id === "number") texts.set(a.id, (a.message ?? "").trim());
            } catch (err) {
              console.error("chat watch: answered messages not read:", err);
            }
          }
          for (const r of replies) {
            const answered = texts.get(r.to);
            if (answered) r.item.replyText = answered.slice(0, REPLY_TEXT_MAX);
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
      // Stored before anything else: the sources above already moved their
      // last_message_id on, so messages not stored now are never read again
      // (11–12.11 the views below ran past the time limit and lost them).
      fresh = await storeFound(admin, found);

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
