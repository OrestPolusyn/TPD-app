function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  officialInfoUrl: () => process.env.OFFICIAL_INFO_URL ?? null,
  telegramBotUsername: () => process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  telegramMiniAppName: () => process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME ?? null,
  devLoginEnabled: () => process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true",
};

export type PrivacyConfig = { controllerName: string; contactEmail: string };

/**
 * Reads PRIVACY_CONTROLLER_NAME / PRIVACY_CONTACT_EMAIL.
 * In production: throws (fails `next build`, since /privacy is statically rendered).
 * In development: returns null so the page can show a "TODO: not configured" banner.
 * See docs/SPEC.md "Privacy policy" and the build prompt's override for this rule.
 */
export function getPrivacyConfig(): PrivacyConfig | null {
  const controllerName = process.env.PRIVACY_CONTROLLER_NAME;
  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL;

  if (controllerName && contactEmail) {
    return { controllerName, contactEmail };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRIVACY_CONTROLLER_NAME and PRIVACY_CONTACT_EMAIL must both be set in production (see .env.example)."
    );
  }

  return null;
}
