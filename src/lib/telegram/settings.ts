import { createAdminClient } from "@/lib/supabase/admin";

/**
 * An operator setting: the env var when set, else the app_settings row
 * (0014). The table is there because the env route — open the hosting
 * dashboard, add a variable, redeploy — is three silent steps for what is
 * one value, and it is what the owner can change without a redeploy.
 */
export async function getSetting(envName: string, key: string): Promise<string | null> {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;

  try {
    const { data, error } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
    if (error) {
      console.error(`could not read setting ${key}:`, error.message);
      return null;
    }
    return data?.value?.trim() || null;
  } catch (err) {
    console.error(`could not read setting ${key}:`, err);
    return null;
  }
}

/** The owner's chat: where admin notices go and the only chat /stats answers. */
export function getModeratorChatId() {
  return getSetting("TELEGRAM_ADMIN_CHAT_ID", "moderator_chat_id");
}

/**
 * The separate admin bot's token. When unset, admin notices keep going
 * through the main (login) bot, exactly as before it existed.
 */
export function getAdminBotToken() {
  return getSetting("TELEGRAM_ADMIN_BOT_TOKEN", "admin_bot_token");
}

/** The public updates channel, as "@name" or "-100…". Unset = no publishing. */
export function getUpdatesChannel() {
  return getSetting("TELEGRAM_UPDATES_CHANNEL", "updates_channel");
}

/**
 * Shared secret between the database and /api/telegram/drafts-dispatch:
 * the trigger that fires when a draft is inserted sends it as a header.
 */
export function getDispatchSecret() {
  return getSetting("DRAFTS_DISPATCH_SECRET", "dispatch_secret");
}
