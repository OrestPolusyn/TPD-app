import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { dispatchDrafts, postPublishedComment, refreshChannelPosts, setAdminCommands } from "@/lib/telegram/adminBot";
import { getAdminBotToken, getDispatchSecret, getModeratorChatId } from "@/lib/telegram/settings";

export const dynamic = "force-dynamic";
// Publishing drafts on arrival (auto mode) posts to the channel one by one.
export const maxDuration = 60;

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sends new drafts to the owner's admin bot without them asking (/pending).
 *
 * Called by the database: a trigger on bot_actions (migration 0031) posts
 * here through pg_net whenever a draft is inserted. Authenticated by the
 * shared secret in app_settings.dispatch_secret, which only the service role
 * and the trigger can read.
 *
 * Body (all optional): `resend` sends every open draft again, even ones
 * already shown — for when the message format changes; `refresh` redraws
 * the published channel posts too; `post_comments` (action ids) posts
 * unconfirmed comments already on the site to the channel.
 */
export async function POST(request: NextRequest) {
  const secret = await getDispatchSecret();
  if (!secret || !sameSecret(request.headers.get("x-dispatch-secret"), secret)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { resend?: boolean; refresh?: boolean; post_comments?: number[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // An empty body is the trigger's normal call.
  }

  const result: Record<string, unknown> = { ok: true };
  try {
    result.drafts = await dispatchDrafts({ resend: body.resend === true });
    if (Array.isArray(body.post_comments)) {
      let posted = 0;
      for (const id of body.post_comments.filter((n) => Number.isInteger(n)).slice(0, 12)) {
        if (await postPublishedComment(id)) posted++;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      result.comments_posted = posted;
    }
    if (body.refresh === true) {
      result.posts = await refreshChannelPosts();
      // New commands show up in the owner's menu without a trip to /admin-setup.
      const [token, owner] = await Promise.all([getAdminBotToken(), getModeratorChatId()]);
      if (token && owner) result.commands = (await setAdminCommands(token, owner)).ok;
    }
  } catch (err) {
    console.error("drafts dispatch failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
  return NextResponse.json(result);
}
