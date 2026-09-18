import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics. Reports whether each expected environment variable
 * is present and whether the app can actually reach Supabase — the failure
 * that otherwise surfaces only as a generic error page on every data route.
 *
 * Never returns a secret value: keys and the bot token are reported as
 * booleans. The Supabase URL's host is included because it is already public
 * (Next.js inlines NEXT_PUBLIC_* into the browser bundle).
 */
export async function GET() {
  const present = (name: string) => Boolean(process.env[name]);

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    TELEGRAM_BOT_TOKEN: present("TELEGRAM_BOT_TOKEN"),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: present("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME"),
    NEXT_PUBLIC_SITE_URL: present("NEXT_PUBLIC_SITE_URL"),
    OFFICIAL_INFO_URL: present("OFFICIAL_INFO_URL"),
    PRIVACY_CONTROLLER_NAME: present("PRIVACY_CONTROLLER_NAME"),
    PRIVACY_CONTACT_EMAIL: present("PRIVACY_CONTACT_EMAIL"),
  };

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let supabaseUrlHost: string | null = null;
  let supabaseUrlLooksValid = false;
  try {
    const parsed = new URL(rawUrl);
    supabaseUrlHost = parsed.host;
    // A correct project URL is just the origin — a pasted REST endpoint
    // (".../rest/v1/") makes every query 404.
    supabaseUrlLooksValid = parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    supabaseUrlHost = null;
  }

  // Everything in this block is already public: Next.js inlines NEXT_PUBLIC_*
  // into the browser bundle. It is here because "Bot domain invalid" from the
  // Telegram Login Widget means the bot has no domain linked matching the page
  // serving it, and `setdomainShouldBe` is exactly the value to hand
  // @BotFather's /setdomain — bare host, no scheme, no trailing slash.
  let siteUrlHost: string | null = null;
  try {
    siteUrlHost = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host;
  } catch {
    siteUrlHost = null;
  }
  const telegram = {
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null,
    miniAppName: process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || null,
    siteUrlHost,
    setdomainShouldBe: siteUrlHost,
  };

  let supabase: { ok: boolean; error: string | null; publishedLocations: number | null } = {
    ok: false,
    error: null,
    publishedLocations: null,
  };

  try {
    const client = await createClient();
    const { count, error } = await client
      .from("locations")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "published");
    supabase = error
      ? // A network-level failure comes back with an empty `message`, so fall
        // back to the whole object rather than reporting a blank error.
        { ok: false, error: error.message || JSON.stringify(error), publishedLocations: null }
      : { ok: true, error: null, publishedLocations: count ?? 0 };
  } catch (err) {
    supabase = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      publishedLocations: null,
    };
  }

  // supabase-js reports a network-level failure as an empty message, so probe
  // the REST endpoint directly too: the HTTP status separates "unreachable"
  // from "wrong key" (401) and "wrong URL path" (404).
  let restProbe: { status: number | null; error: string | null } = { status: null, error: null };
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (rawUrl && anonKey) {
    try {
      const res = await fetch(`${rawUrl.replace(/\/$/, "")}/rest/v1/`, {
        headers: { apikey: anonKey },
        cache: "no-store",
      });
      restProbe = { status: res.status, error: null };
    } catch (err) {
      restProbe = { status: null, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    env,
    supabaseUrlHost,
    supabaseUrlLooksValid,
    telegram,
    supabase,
    restProbe,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
