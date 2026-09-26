import { callTelegram, getWebhookInfo } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { getAdminBotToken, getModeratorChatId, getUpdatesChannel } from "@/lib/telegram/settings";
import { publishChannelPost, locationUrl, updateChannelPost } from "@/lib/telegram/channel";
import { guidePostText } from "@/lib/guide";
import { createAdminClient } from "@/lib/supabase/admin";
import { madridDate } from "@/lib/stats";
import { formatDate } from "@/lib/format";
import { config } from "@/lib/config";
import { cityHashtagUk, cityUk } from "@/lib/cityNames";
import { esc } from "@/lib/telegram/html";
import messages from "../../../messages/uk.json";

/** Where the admin bot's updates arrive (/api/telegram/admin-webhook). */
export function adminWebhookUrl(): string {
  return `${config.siteUrl().replace(/\/$/, "")}/api/telegram/admin-webhook`;
}

let adminWebhookChecked: string | null = null;

/**
 * Points the admin bot at this deployment if it is not already.
 *
 * The sandbox that builds this app cannot reach Telegram, and nobody should
 * have to remember a setup URL: the first notice sent through a newly
 * configured admin bot registers its webhook, so its buttons and /stats work
 * from then on. Once per server instance per token.
 */
export async function ensureAdminWebhook(token: string): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  if (adminWebhookChecked === token) return { ok: true, changed: false };
  const url = adminWebhookUrl();
  const info = await getWebhookInfo(token);
  const wanted = ["message", "callback_query"];
  if (info?.url === url && wanted.every((u) => info.allowed_updates?.includes(u))) {
    adminWebhookChecked = token;
    return { ok: true, changed: false };
  }
  const res = await callTelegram(token, "setWebhook", {
    url,
    secret_token: deriveWebhookSecret(token),
    allowed_updates: wanted,
  });
  if (res.ok) adminWebhookChecked = token;
  return { ok: res.ok, changed: res.ok, error: res.ok ? undefined : res.description };
}

/** The command menu, shown only in the owner's chat with the admin bot. */
export function setAdminCommands(token: string, owner: string) {
  const t = messages.telegramBot;
  return callTelegram(token, "setMyCommands", {
    commands: [
      { command: "pending", description: t.adminCommandPending },
      { command: "stats", description: t.adminCommandStats },
      { command: "post_guide", description: t.adminCommandPostGuide },
      { command: "refresh_posts", description: t.adminCommandRefreshPosts },
    ],
    scope: { type: "chat", chat_id: owner },
  });
}

export type NoticeAction =
  | { kind: "publish_report"; payload: { report_id: string } }
  | { kind: "accept_change"; payload: ChangePayload }
  | { kind: "publish_story"; payload: StoryPayload };

/** A reader's story from "💬 Моя історія". Published without their name. */
export interface StoryPayload {
  story: string;
  location_id: string | null;
  source: "telegram";
}

/**
 * A reported or drafted change. Beyond the office and the text, a draft
 * prepared from the chats can say which kind of card bullet it is,
 * which outdated bullets it replaces (hidden on accept, so the card never
 * says both "довідка з мокрою печаткою" and "лише штамп"), and which other
 * offices share it (Madrid's comisaría and CREADE are one route).
 */
export interface ChangePayload {
  location_id: string;
  detail: string;
  user_id?: string;
  source?: string;
  kind?: "document" | "info";
  retire_note_ids?: string[];
  also_location_ids?: string[];
}

/** One button under an admin notice; `variant` picks what the action does. */
export interface ActionButton {
  label: string;
  variant?: "a" | "r" | "x";
}

/**
 * Stores the action and returns the keyboard that triggers it — one action
 * row, several buttons (`act:<id>:<variant>`), so "add", "add as a rule
 * change" and "reject" share one one-shot claim.
 *
 * Never throws: a notice without its buttons is still worth sending, a
 * notice lost because the buttons could not be stored is not.
 */
export async function createActionButtons(action: NoticeAction, buttons: ActionButton[]) {
  try {
    const { data, error } = await createAdminClient()
      .from("bot_actions")
      .insert({ kind: action.kind, payload: action.payload })
      .select("id")
      .single();
    if (error || !data) {
      console.error("could not store bot action:", error?.message);
      return undefined;
    }
    return {
      inline_keyboard: buttons.map((b) => [
        { text: b.label, callback_data: b.variant ? `act:${data.id}:${b.variant}` : `act:${data.id}` },
      ]),
    };
  } catch (err) {
    console.error("could not store bot action:", err);
    return undefined;
  }
}

const OUTCOME_ICON: Record<string, string> = {
  protection_granted: "✅",
  application_accepted_pending: "⏳",
  turned_away: "❌",
  could_not_get_appointment: "📵",
};

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface OfficeRef {
  id: string;
  city: string;
  name: string;
}

/**
 * The first lines of every post: the city in Ukrainian and bold, so a reader
 * scrolling the channel sees at once whether it is about them, then the
 * office(s) in italics. "Pozuelo de Alarcón" alone left people guessing that
 * it was Madrid.
 */
function officesHeading(offices: OfficeRef[], suffix?: string): string[] {
  const cities = [...new Set(offices.map((o) => cityUk(o.city)))];
  const title = `📍 <b>${esc(cities.join(", "))}</b>${suffix ? ` · ${esc(suffix)}` : ""}`;
  return [title, ...offices.map((o) => `<i>${esc(o.name)}</i>`)];
}

function hashtags(offices: OfficeRef[]): string {
  return [...new Set(offices.map((o) => cityHashtagUk(o.city)))].join(" ");
}

/**
 * Reports copied from the community chats start with "З чату спільноти: …".
 * In a post that reads better as a label above the quote than as the first
 * words of it.
 */
export function splitSourceLabel(comment: string): { label: string | null; text: string } {
  const match = /^(З чат[^:\n]{0,60}):\s*/u.exec(comment);
  return match ? { label: match[1], text: comment.slice(match[0].length) } : { label: null, text: comment };
}

interface ReportForPost {
  location: OfficeRef;
  outcome: string;
  event_date: string;
  comment: string | null;
  requested: string[];
  missing: string[];
}

/** Channel posts and admin messages are sent with parse_mode HTML. */
export function formatReportPost(r: ReportForPost): string {
  const t = messages.telegramBot;
  const outcomes = messages.outcomes as Record<string, string>;
  const lines = [
    ...officesHeading([r.location]),
    "",
    `${OUTCOME_ICON[r.outcome] ?? "•"} <b>${esc(outcomes[r.outcome] ?? r.outcome)}</b> · ${esc(formatDate(r.event_date))}`,
  ];
  if (r.requested.length > 0) lines.push(`${esc(t.postRequested)}: ${esc(r.requested.join(", "))}`);
  if (r.missing.length > 0) lines.push(`${esc(t.postMissing)}: ${esc(r.missing.join(", "))}`);
  if (r.comment?.trim()) {
    const { label, text } = splitSourceLabel(r.comment.trim());
    lines.push("");
    if (label) lines.push(`💬 <i>${esc(label)}</i>`);
    lines.push(`«${esc(clip(text, 400))}»`);
  }
  lines.push("", `${esc(t.postMore)}: ${esc(locationUrl(r.location.id))}`, hashtags([r.location]));
  return lines.join("\n");
}

/** An accepted change; the first office is the one the link opens. */
export function formatChangePost(offices: OfficeRef[], detail: string): string {
  const t = messages.telegramBot;
  return [
    ...officesHeading(offices, t.postUpdate),
    "",
    esc(clip(detail.trim(), 600)),
    "",
    `${esc(t.postCurrent)}: ${esc(locationUrl(offices[0].id))}`,
    hashtags(offices),
  ].join("\n");
}

export function formatRulePost(offices: OfficeRef[], date: string, detail: string): string {
  const t = messages.telegramBot;
  const cities = [...new Set(offices.map((o) => cityUk(o.city)))].join(", ");
  return [
    `⚠️ <b>${esc(t.postRuleChange)} · ${esc(cities)}</b>`,
    ...offices.map((o) => `<i>${esc(o.name)}</i>`),
    "",
    `<b>${esc(formatDate(date))}:</b> ${esc(clip(detail.trim(), 600))}`,
    "",
    `${esc(t.postCurrent)}: ${esc(locationUrl(offices[0].id))}`,
    `#${esc(t.postRuleTag)} ${hashtags(offices)}`,
  ].join("\n");
}

/** A reader's story, anonymous; tied to an office when it came from one's post. */
export function formatStoryPost(office: OfficeRef | null, story: string): string {
  const t = messages.telegramBot;
  const lines = office ? [...officesHeading([office]), ""] : [];
  lines.push(`💬 <b>${esc(t.postStory)}</b>`, "", `«${esc(clip(story.trim(), 1500))}»`, "", esc(t.postStoryInvite));
  lines.push(office ? `#${esc(t.postStoryTag)} ${hashtags([office])}` : `#${esc(t.postStoryTag)}`);
  return lines.join("\n");
}

async function loadOffice(admin: ReturnType<typeof createAdminClient>, id: string | null): Promise<OfficeRef | null> {
  if (!id) return null;
  const { data } = await admin.from("locations").select("id, city, name").eq("id", id).maybeSingle();
  return (data as OfficeRef | null) ?? null;
}

/** The offices a change applies to, main one first. */
async function loadOffices(admin: ReturnType<typeof createAdminClient>, change: ChangePayload): Promise<OfficeRef[]> {
  const ids = [change.location_id, ...(change.also_location_ids ?? [])];
  const { data } = await admin.from("locations").select("id, city, name").in("id", ids);
  const byId = new Map((data ?? []).map((l) => [l.id as string, l as OfficeRef]));
  return ids.map((id) => byId.get(id)).filter((l): l is OfficeRef => Boolean(l));
}

/**
 * Runs the action behind a tapped button. Returns the short text Telegram
 * shows the owner as the tap's answer.
 *
 * One-shot: `done_at` is claimed with a conditional update before anything
 * is posted, so two taps (or a retried webhook) cannot publish twice. A
 * failure releases the claim so the owner can simply tap again.
 *
 * Variants of accept_change: "a" adds the change to the office card and
 * posts it; "r" does the same and also records it on the rule-changes
 * timeline, posted as "⚠️ Зміна правил"; "x" rejects it.
 */
export async function performAction(actionId: number, variant: string | undefined): Promise<{ text: string; done: boolean }> {
  const t = messages.telegramBot;
  const admin = createAdminClient();

  const { data: claimed, error } = await admin
    .from("bot_actions")
    .update({ done_at: new Date().toISOString() })
    .eq("id", actionId)
    .is("done_at", null)
    .select("kind, payload")
    .maybeSingle();
  if (error) return { text: t.actionFailed, done: false };
  if (!claimed) return { text: t.actionAlready, done: true };

  const release = async (text: string) => {
    await admin.from("bot_actions").update({ done_at: null }).eq("id", actionId);
    return { text, done: false };
  };

  if (variant === "x") return { text: t.actionRejected, done: true };

  if (claimed.kind === "publish_report") {
    const reportId = (claimed.payload as { report_id: string }).report_id;
    const post = await loadReportPost(admin, reportId);
    if (!post) return release(t.actionMissing);
    const res = await publishChannelPost({
      kind: "report",
      locationId: post.location.id,
      text: formatReportPost(post),
      actionId,
    });
    if (!res.ok) return release(`${t.actionFailed} ${res.error ?? ""}`.trim());
    return { text: t.actionPublished, done: true };
  }

  if (claimed.kind === "publish_story") {
    const story = claimed.payload as StoryPayload;
    const office = await loadOffice(admin, story.location_id);
    const res = await publishChannelPost({
      kind: "story",
      locationId: office?.id ?? null,
      text: formatStoryPost(office, story.story),
      actionId,
    });
    if (!res.ok) return release(`${t.actionFailed} ${res.error ?? ""}`.trim());
    return { text: t.actionPublished, done: true };
  }

  const change = claimed.payload as ChangePayload;
  const { location_id, detail } = change;
  const offices = await loadOffices(admin, change);
  if (offices[0]?.id !== location_id) return release(t.actionMissing);

  const today = madridDate(new Date());
  const locationIds = [location_id, ...(change.also_location_ids ?? [])];
  const { error: noteError } = await admin.from("community_notes").insert(
    locationIds.map((id) => ({
      location_id: id,
      kind: change.kind ?? "info",
      position: 0,
      body: clip(detail.trim(), 600),
      observed_on: today,
    }))
  );
  if (noteError) return release(t.actionFailed);
  if (change.retire_note_ids?.length) {
    await admin.from("community_notes").update({ moderation_status: "hidden" }).in("id", change.retire_note_ids);
  }

  const asRule = variant === "r";
  if (asRule) {
    const { error: ruleError } = await admin
      .from("rule_changes")
      .insert({ location_id, effective_date: today, title: clip(detail.trim(), 300) });
    if (ruleError) console.error("rule change not recorded:", ruleError.message);
  }

  const res = await publishChannelPost({
    kind: asRule ? "rule" : "change",
    locationId: location_id,
    text: asRule ? formatRulePost(offices, today, detail) : formatChangePost(offices, detail),
    actionId,
  });
  const channelSet = Boolean(await getUpdatesChannel());
  const text = res.ok
    ? asRule
      ? t.actionRulePublished
      : t.actionAcceptedPublished
    : channelSet
      ? `${t.actionAcceptedSiteOnly} (${res.error ?? "?"})`
      : t.actionAcceptedSiteOnly;
  return { text, done: true };
}

async function loadReportPost(admin: ReturnType<typeof createAdminClient>, reportId: string): Promise<ReportForPost | null> {
  const { data: report } = await admin
    .from("reports")
    .select("location_id, outcome, event_date, comment, moderation_status")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || report.moderation_status !== "published") return null;

  const [{ data: location }, { data: docs }, { data: types }] = await Promise.all([
    admin.from("locations").select("id, name, city").eq("id", report.location_id).maybeSingle(),
    admin.from("report_documents").select("document_code, status").eq("report_id", reportId),
    admin.from("document_types").select("code, label_uk"),
  ]);
  if (!location) return null;

  const label = new Map((types ?? []).map((d) => [d.code as string, d.label_uk as string]));
  const named = (status: string) =>
    (docs ?? []).filter((d) => d.status === status).map((d) => label.get(d.document_code as string) ?? (d.document_code as string));

  return {
    location,
    outcome: report.outcome as string,
    event_date: report.event_date as string,
    comment: report.comment as string | null,
    requested: named("requested"),
    missing: named("requested_missing"),
  };
}

/** The keyboard for an action that already exists (drafts listed by /pending). */
export function actionKeyboard(actionId: number, kind: string, channelSet: boolean) {
  const t = messages.telegramBot;
  if (kind === "publish_report" || kind === "publish_story") {
    return {
      inline_keyboard: [
        [{ text: kind === "publish_story" ? t.publishStoryButton : t.publishButton, callback_data: `act:${actionId}` }],
        [{ text: t.rejectButton, callback_data: `act:${actionId}:x` }],
      ],
    };
  }
  return {
    inline_keyboard: [
      [{ text: channelSet ? t.acceptChangeButton : t.acceptChangeSiteOnlyButton, callback_data: `act:${actionId}:a` }],
      [{ text: t.acceptRuleButton, callback_data: `act:${actionId}:r` }],
      [{ text: t.rejectButton, callback_data: `act:${actionId}:x` }],
    ],
  };
}

interface DraftRow {
  id: number;
  kind: string;
  payload: unknown;
}

/**
 * One draft as the owner sees it: the post exactly as it would appear in the
 * channel, under a header, plus which card bullets it would replace.
 * Null when what it points at is gone.
 */
export async function describeDraft(d: DraftRow): Promise<string | null> {
  const t = messages.telegramBot;
  const admin = createAdminClient();
  if (d.kind === "publish_report") {
    const post = await loadReportPost(admin, (d.payload as { report_id: string }).report_id);
    return post ? `<b>${esc(t.draftReportHeader)}</b>\n\n${formatReportPost(post)}` : null;
  }
  const change = d.payload as ChangePayload;
  const offices = await loadOffices(admin, change);
  if (offices.length === 0) return null;
  const lines = [`<b>${esc(t.draftHeader)}</b>`, "", formatChangePost(offices, change.detail)];
  if (change.retire_note_ids?.length) {
    const { data: old } = await admin.from("community_notes").select("body").in("id", change.retire_note_ids);
    if (old?.length) lines.push("", `<b>${esc(t.draftReplaces)}:</b>`, ...old.map((n) => `• <s>${esc(n.body as string)}</s>`));
  }
  return lines.join("\n");
}

/** Drafts still waiting for the owner, for /pending. */
export async function describeDrafts(): Promise<{ id: number; kind: string; text: string }[]> {
  const { data: drafts } = await createAdminClient()
    .from("bot_actions")
    .select("id, kind, payload")
    .is("done_at", null)
    .eq("payload->>source", "draft")
    .order("id");

  const out: { id: number; kind: string; text: string }[] = [];
  for (const d of (drafts ?? []) as DraftRow[]) {
    const text = await describeDraft(d);
    if (text) out.push({ id: d.id, kind: d.kind, text });
  }
  return out;
}

/**
 * Sends every draft the owner has not been shown yet, each with its buttons.
 *
 * Drafts are rows written straight into bot_actions (from the chats, by
 * hand or by a script), so nothing in the app sees them arrive; a database
 * trigger calls /api/telegram/drafts-dispatch, which calls this. Claimed via
 * notified_at before sending, so a second trigger firing meanwhile cannot
 * send a draft twice; released again if Telegram refuses it.
 */
export async function dispatchDrafts(opts: { resend?: boolean } = {}): Promise<{ sent: number; failed: number }> {
  const token = await getAdminBotToken();
  const chatId = await getModeratorChatId();
  if (!token || !chatId) return { sent: 0, failed: 0 };

  const admin = createAdminClient();
  let query = admin
    .from("bot_actions")
    .update({ notified_at: new Date().toISOString() })
    .is("done_at", null)
    .eq("payload->>source", "draft");
  if (!opts.resend) query = query.is("notified_at", null);
  const { data: claimed, error } = await query.select("id, kind, payload");
  if (error) {
    console.error("could not claim drafts:", error.message);
    return { sent: 0, failed: 0 };
  }

  const channelSet = Boolean(await getUpdatesChannel());
  let sent = 0;
  let failed = 0;
  const ordered = ((claimed ?? []) as DraftRow[]).sort((a, b) => a.id - b.id);
  for (const d of ordered) {
    const text = await describeDraft(d);
    const res = text
      ? await callTelegram(token, "sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: actionKeyboard(d.id, d.kind, channelSet),
        })
      : { ok: false, description: "draft target missing" };
    if (res.ok) {
      sent++;
    } else {
      failed++;
      console.error(`draft ${d.id} not sent:`, res.description);
      await admin.from("bot_actions").update({ notified_at: null }).eq("id", d.id);
    }
  }
  return { sent, failed };
}

/**
 * Redraws a published channel post from what it was made of — for when the
 * post format changes (Ukrainian city names) and old posts should match.
 * Only posts that remember their source (action_id, or the guide).
 */
export async function refreshChannelPosts(): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: posts } = await admin
    .from("channel_posts")
    .select("id, kind, action_id, created_at")
    .not("message_id", "is", null)
    .order("id");

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const post of posts ?? []) {
    let text: string | null = null;
    let detailUrl: string | undefined;
    if (post.kind === "guide") {
      text = guidePostText();
      detailUrl = `${config.siteUrl().replace(/\/$/, "")}/guide/dovidka`;
    } else if (post.action_id) {
      const { data: action } = await admin.from("bot_actions").select("kind, payload").eq("id", post.action_id).maybeSingle();
      if (action?.kind === "publish_story") {
        const story = action.payload as StoryPayload;
        text = formatStoryPost(await loadOffice(admin, story.location_id), story.story);
      } else if (action?.kind === "publish_report") {
        const report = await loadReportPost(admin, (action.payload as { report_id: string }).report_id);
        text = report ? formatReportPost(report) : null;
      } else if (action) {
        const change = action.payload as ChangePayload;
        const offices = await loadOffices(admin, change);
        if (offices.length > 0) {
          text =
            post.kind === "rule"
              ? formatRulePost(offices, madridDate(new Date(post.created_at as string)), change.detail)
              : formatChangePost(offices, change.detail);
        }
      }
    }
    if (!text) {
      skipped++;
      errors.push(`#${post.id}: nothing to draw it from`);
      continue;
    }
    const res = await updateChannelPost(post.id as number, text, detailUrl);
    if (res.ok) updated++;
    else {
      skipped++;
      errors.push(`#${post.id}: ${res.error ?? "?"}`);
      console.error(`channel post ${post.id} not refreshed:`, res.error);
    }
  }
  return { updated, skipped, errors };
}
