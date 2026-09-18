function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * BotFather prints the username as "@my_bot" and it is easy to paste that, or a
 * stray space, into the deploy env. The Login Widget takes a bare username in
 * `data-telegram-login`, so normalise here rather than trusting the variable.
 */
function normalizeBotUsername(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/^@+/, "") ?? "";
  return value === "" ? null : value;
}

export const config = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  officialInfoUrl: () => process.env.OFFICIAL_INFO_URL ?? null,
  telegramBotUsername: () => normalizeBotUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME),
  telegramMiniAppName: () => process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME ?? null,
  devLoginEnabled: () => process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true",
};

export type PrivacyConfig = { controllerName: string; contactEmail: string };

/**
 * Reads PRIVACY_CONTROLLER_NAME / PRIVACY_CONTACT_EMAIL, returning null when
 * either is missing so /privacy can render a visible "not configured" notice.
 *
 * This used to throw in production, which failed `next build` outright — but
 * `next build` runs with NODE_ENV=production for *every* environment,
 * including Vercel preview deployments, so a variable scoped to Production
 * only would brick the whole deployment over one page. The guardrail is now
 * a loud on-page notice plus a server-side error log, which surfaces the
 * same misconfiguration without taking the rest of the app down with it.
 */
export function getPrivacyConfig(): PrivacyConfig | null {
  const controllerName = process.env.PRIVACY_CONTROLLER_NAME;
  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL;

  if (controllerName && contactEmail) {
    return { controllerName, contactEmail };
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "PRIVACY_CONTROLLER_NAME and PRIVACY_CONTACT_EMAIL must both be set in production (see .env.example). /privacy is rendering without a named data controller."
    );
  }

  return null;
}
