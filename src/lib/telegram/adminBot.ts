import { callTelegram, getWebhookInfo } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { getUpdatesChannel } from "@/lib/telegram/settings";
import { publishChannelPost, locationUrl } from "@/lib/telegram/channel";
import { createAdminClient } from "@/lib/supabase/admin";
import { madridDate } from "@/lib/stats";
import { formatDate } from "@/lib/format";
import { config } from "@/lib/config";
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

export type NoticeAction =
  | { kind: "publish_report"; payload: { report_id: string } }
  | { kind: "accept_change"; payload: ChangePayload };

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

/** "#Alicante", "#PuertodelaCruz" — searchable in the channel. */
export function cityHashtag(city: string): string {
  return `#${city.replace(/[^\p{L}\p{N}]/gu, "")}`;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

interface ReportForPost {
  location: { id: string; name: string; city: string };
  outcome: string;
  event_date: string;
  comment: string | null;
  requested: string[];
  missing: string[];
}

export function formatReportPost(r: ReportForPost): string {
  const t = messages.telegramBot;
  const outcomes = messages.outcomes as Record<string, string>;
  const lines = [
    `📍 ${r.location.city} — ${r.location.name}`,
    `${OUTCOME_ICON[r.outcome] ?? "•"} ${outcomes[r.outcome] ?? r.outcome} · ${formatDate(r.event_date)}`,
  ];
  if (r.requested.length > 0) lines.push(`${t.postRequested}: ${r.requested.join(", ")}`);
  if (r.missing.length > 0) lines.push(`${t.postMissing}: ${r.missing.join(", ")}`);
  if (r.comment?.trim()) lines.push("", `«${clip(r.comment.trim(), 400)}»`);
  lines.push("", `${t.postMore}: ${locationUrl(r.location.id)}`, cityHashtag(r.location.city));
  return lines.join("\n");
}

export function formatChangePost(location: { id: string; city: string; name: string }, detail: string): string {
  const t = messages.telegramBot;
  return [
    `📍 ${location.city} — ${t.postUpdate}`,
    location.name,
    "",
    clip(detail.trim(), 600),
    "",
    `${t.postCurrent}: ${locationUrl(location.id)}`,
    cityHashtag(location.city),
  ].join("\n");
}

export function formatRulePost(location: { id: string; city: string; name: string }, date: string, detail: string): string {
  const t = messages.telegramBot;
  return [
    `⚠️ ${t.postRuleChange} · ${location.city}`,
    location.name,
    "",
    `${formatDate(date)}: ${clip(detail.trim(), 600)}`,
    "",
    `${t.postCurrent}: ${locationUrl(location.id)}`,
    `#${t.postRuleTag} ${cityHashtag(location.city)}`,
  ].join("\n");
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
    const res = await publishChannelPost({ kind: "report", locationId: post.location.id, text: formatReportPost(post) });
    if (!res.ok) return release(`${t.actionFailed} ${res.error ?? ""}`.trim());
    return { text: t.actionPublished, done: true };
  }

  const change = claimed.payload as ChangePayload;
  const { location_id, detail } = change;
  const { data: location } = await admin.from("locations").select("id, name, city").eq("id", location_id).maybeSingle();
  if (!location) return release(t.actionMissing);

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
    text: asRule ? formatRulePost(location, today, detail) : formatChangePost(location, detail),
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
  if (kind === "publish_report") {
    return {
      inline_keyboard: [
        [{ text: t.publishButton, callback_data: `act:${actionId}` }],
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

/**
 * Drafts waiting for the owner: updates prepared from the chats (bot_actions
 * with payload.source = "draft"), each rendered as the message it would
 * become plus what it would replace. Sent one message per draft by /pending.
 */
export async function describeDrafts(): Promise<{ id: number; kind: string; text: string }[]> {
  const t = messages.telegramBot;
  const admin = createAdminClient();
  const { data: drafts } = await admin
    .from("bot_actions")
    .select("id, kind, payload")
    .is("done_at", null)
    .eq("payload->>source", "draft")
    .order("id");

  const out: { id: number; kind: string; text: string }[] = [];
  for (const d of drafts ?? []) {
    if (d.kind === "publish_report") {
      const post = await loadReportPost(admin, (d.payload as { report_id: string }).report_id);
      if (post) out.push({ id: d.id, kind: d.kind, text: `${t.draftReportHeader}\n\n${formatReportPost(post)}` });
      continue;
    }
    const change = d.payload as ChangePayload;
    const ids = [change.location_id, ...(change.also_location_ids ?? [])];
    const { data: locs } = await admin.from("locations").select("id, city, name").in("id", ids);
    const main = locs?.find((l) => l.id === change.location_id);
    const others = (locs ?? []).filter((l) => l.id !== change.location_id).map((l) => l.name);
    const lines = [`${t.draftHeader} · ${main?.city ?? change.location_id}`, main?.name ?? "", "", change.detail];
    if (others.length) lines.push("", `${t.draftAlso}: ${others.join(", ")}`);
    if (change.retire_note_ids?.length) {
      const { data: old } = await admin.from("community_notes").select("body").in("id", change.retire_note_ids);
      if (old?.length) lines.push("", `${t.draftReplaces}:`, ...old.map((n) => `• ${n.body}`));
    }
    out.push({ id: d.id, kind: d.kind, text: lines.join("\n") });
  }
  return out;
}
