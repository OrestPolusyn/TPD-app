import { callTelegram, getWebhookInfo } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { getUpdatesChannel } from "@/lib/telegram/settings";
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
  | { kind: "publish_report"; payload: { report_id: string }; label: string }
  | { kind: "accept_change"; payload: { location_id: string; user_id: string; detail: string }; label: string };

/**
 * Stores the action and returns the one-button keyboard that triggers it.
 * Never throws: a notice without its button is still worth sending, a
 * notice lost because the button could not be stored is not.
 */
export async function createActionButton(action: NoticeAction) {
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
    return { inline_keyboard: [[{ text: action.label, callback_data: `act:${data.id}` }]] };
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

function locationUrl(id: string): string {
  return `${config.siteUrl().replace(/\/$/, "")}/locations/${id}`;
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

async function publish(token: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const channel = await getUpdatesChannel();
  if (!channel) return { ok: false, error: "no_channel" };
  const res = await callTelegram(token, "sendMessage", {
    chat_id: channel,
    text,
    link_preview_options: { is_disabled: true },
  });
  return { ok: res.ok, error: res.description };
}

/**
 * Runs the action behind a tapped button. Returns the short text Telegram
 * shows the owner as the tap's answer.
 *
 * One-shot: `done_at` is claimed with a conditional update before anything
 * is posted, so two taps (or a retried webhook) cannot publish twice.
 */
export async function performAction(token: string, actionId: number): Promise<{ text: string; done: boolean }> {
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

  const release = () => admin.from("bot_actions").update({ done_at: null }).eq("id", actionId);

  if (claimed.kind === "publish_report") {
    const reportId = (claimed.payload as { report_id: string }).report_id;
    const post = await loadReportPost(admin, reportId);
    if (!post) {
      await release();
      return { text: t.actionMissing, done: false };
    }
    const res = await publish(token, formatReportPost(post));
    if (!res.ok) {
      await release();
      return { text: `${t.actionFailed} ${res.error ?? ""}`.trim(), done: false };
    }
    return { text: t.actionPublished, done: true };
  }

  // accept_change: the owner vouches for the reported change — it becomes a
  // bullet on the office's card, dated today, and goes to the channel.
  const { location_id, detail } = claimed.payload as { location_id: string; detail: string };
  const { data: location } = await admin.from("locations").select("id, name, city").eq("id", location_id).maybeSingle();
  if (!location) {
    await release();
    return { text: t.actionMissing, done: false };
  }
  const { error: noteError } = await admin.from("community_notes").insert({
    location_id,
    kind: "info",
    position: 0,
    body: clip(detail.trim(), 600),
    observed_on: madridDate(new Date()),
  });
  if (noteError) {
    await release();
    return { text: t.actionFailed, done: false };
  }
  const res = await publish(token, formatChangePost(location, detail));
  return { text: res.ok ? t.actionAcceptedPublished : t.actionAcceptedSiteOnly, done: true };
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
