/**
 * The server's own Telegram user login, for reading the groups the owner
 * follows. GramJS, not the Bot API: a bot cannot read a group unless an
 * admin adds it, and these groups are other people's.
 *
 * Every function here connects, does its job and destroys the client — a
 * serverless function must not leave GramJS's reconnect timers behind, or it
 * stays alive until its time limit.
 */
// Root imports only: the package is loaded by Node at runtime
// (serverExternalPackages), and it has no "exports" map for subpaths.
import { TelegramClient, Api, sessions, password as srp } from "telegram";
import bigInt from "big-integer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/telegram/settings";

export interface ApiCredentials {
  apiId: number;
  apiHash: string;
}

export async function getApiCredentials(): Promise<ApiCredentials | null> {
  const [id, hash] = await Promise.all([
    getSetting("TELEGRAM_API_ID", "tg_api_id"),
    getSetting("TELEGRAM_API_HASH", "tg_api_hash"),
  ]);
  return id && /^\d+$/.test(id) && hash ? { apiId: Number(id), apiHash: hash } : null;
}

export function getSession() {
  return getSetting("TELEGRAM_USER_SESSION", "tg_session");
}

export async function saveSetting(key: string, value: string | null): Promise<void> {
  const admin = createAdminClient();
  if (value === null) {
    await admin.from("app_settings").delete().eq("key", key);
    return;
  }
  const { error } = await admin.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`could not save ${key}: ${error.message}`);
}

function newClient(session: string, creds: ApiCredentials): TelegramClient {
  const client = new TelegramClient(new sessions.StringSession(session), creds.apiId, creds.apiHash, {
    connectionRetries: 2,
    // Never sleep through a long flood wait inside a 60-second function.
    floodSleepThreshold: 5,
    deviceModel: "TP Spain server",
    appVersion: "1.0",
  });
  client.setLogLevel("error" as never);
  return client;
}

/** Runs `fn` with a connected client and always tears it down afterwards. */
export async function withClient<T>(session: string, creds: ApiCredentials, fn: (client: TelegramClient) => Promise<T>): Promise<T> {
  const client = newClient(session, creds);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.destroy().catch(() => undefined);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type QrLoginResult =
  | { status: "ok"; name: string }
  | { status: "password"; hint: string | null }
  | { status: "timeout" };

/**
 * "Link desktop device": shows QR codes (through `onQr`) until the owner
 * scans one with their phone, then stores the session.
 *
 * Telegram only completes a scan that someone is waiting for (it announces
 * it with UpdateLoginToken on this connection), and a token lasts ~30 s, so
 * a fresh code is shown whenever the old one expires, until `deadline`.
 *
 * With two-step verification the scan is not enough: the half-signed-in
 * session is kept as tg_session_pending and the password comes separately
 * (completePasswordLogin).
 */
export async function qrLogin(
  creds: ApiCredentials,
  deadline: number,
  onQr: (url: string) => Promise<void>
): Promise<QrLoginResult> {
  const client = newClient("", creds);
  await client.connect();
  let scanned = false;
  // No event filter = every raw update.
  client.addEventHandler((update) => {
    if (update instanceof Api.UpdateLoginToken) scanned = true;
  });

  const exportToken = () =>
    client.invoke(new Api.auth.ExportLoginToken({ apiId: creds.apiId, apiHash: creds.apiHash, exceptIds: [] }));

  try {
    let res: Api.auth.TypeLoginToken = await exportToken();
    while (true) {
      if (res instanceof Api.auth.LoginToken) {
        if (Date.now() >= deadline) return { status: "timeout" };
        await onQr(`tg://login?token=${Buffer.from(res.token).toString("base64url")}`);
        const until = Math.min(res.expires * 1000, deadline);
        while (!scanned && Date.now() < until) await sleep(1000);
        if (!scanned && Date.now() >= deadline) return { status: "timeout" };
        scanned = false;
        res = await exportToken();
        continue;
      }
      if (res instanceof Api.auth.LoginTokenMigrateTo) {
        await client._switchDC(res.dcId);
        res = await client.invoke(new Api.auth.ImportLoginToken({ token: res.token }));
        continue;
      }
      // LoginTokenSuccess
      await saveSetting("tg_session", client.session.save() as unknown as string);
      await saveSetting("tg_session_pending", null);
      const me = (await client.getMe()) as Api.User;
      return { status: "ok", name: [me.firstName, me.lastName].filter(Boolean).join(" ") || me.username || "" };
    }
  } catch (err) {
    if ((err as { errorMessage?: string }).errorMessage === "SESSION_PASSWORD_NEEDED") {
      await saveSetting("tg_session_pending", client.session.save() as unknown as string);
      const password = await client.invoke(new Api.account.GetPassword()).catch(() => null);
      return { status: "password", hint: password?.hint ?? null };
    }
    throw err;
  } finally {
    await client.destroy().catch(() => undefined);
  }
}

/** The two-step verification password, after a QR scan asked for it. */
export async function completePasswordLogin(creds: ApiCredentials, password: string): Promise<string> {
  const pending = await getSetting("TELEGRAM_USER_SESSION_PENDING", "tg_session_pending");
  if (!pending) throw new Error("no_pending_login");
  return withClient(pending, creds, async (client) => {
    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    await client.invoke(new Api.auth.CheckPassword({ password: await srp.computeCheck(passwordInfo, password) }));
    await saveSetting("tg_session", client.session.save() as unknown as string);
    await saveSetting("tg_session_pending", null);
    const me = (await client.getMe()) as Api.User;
    return [me.firstName, me.lastName].filter(Boolean).join(" ") || me.username || "";
  });
}

export interface SourcePeer {
  peer_type: "channel" | "chat";
  peer_id: string;
  access_hash: string | null;
}

export function inputPeer(source: SourcePeer): Api.TypeInputPeer {
  if (source.peer_type === "chat") return new Api.InputPeerChat({ chatId: bigInt(source.peer_id) });
  return new Api.InputPeerChannel({ channelId: bigInt(source.peer_id), accessHash: bigInt(source.access_hash ?? "0") });
}

export interface ResolvedSource extends SourcePeer {
  title: string;
  username: string | null;
  topic: number | null;
}

/**
 * Looks a pasted source up once, when it is added: a username directly, a
 * private t.me/c/<id> link among the account's own chats (the only place
 * its access hash is available).
 */
export async function resolveSource(
  client: TelegramClient,
  ref: { username?: string; channelId?: string; topic: number | null }
): Promise<ResolvedSource> {
  let entity: Api.TypeChat | Api.TypeUser | undefined;
  if (ref.username) {
    entity = (await client.getEntity(ref.username)) as Api.TypeChat;
  } else if (ref.channelId) {
    for await (const dialog of client.iterDialogs({ limit: 500 })) {
      if (dialog.entity && "id" in dialog.entity && dialog.entity.id.toString() === ref.channelId) {
        entity = dialog.entity as Api.TypeChat;
        break;
      }
    }
  }
  if (!entity) throw new Error("not_found");

  let peer: SourcePeer;
  if (entity instanceof Api.Channel) {
    peer = { peer_type: "channel", peer_id: entity.id.toString(), access_hash: entity.accessHash?.toString() ?? null };
  } else if (entity instanceof Api.Chat) {
    peer = { peer_type: "chat", peer_id: entity.id.toString(), access_hash: null };
  } else {
    throw new Error("not_a_group");
  }

  let title = (entity as Api.Channel | Api.Chat).title;
  if (ref.topic) {
    try {
      const [topicStart] = await client.getMessages(inputPeer(peer), { ids: [ref.topic] });
      const action = (topicStart as unknown as Api.MessageService | undefined)?.action;
      title = action instanceof Api.MessageActionTopicCreate ? `${title} · ${action.title}` : `${title} · тема ${ref.topic}`;
    } catch {
      title = `${title} · тема ${ref.topic}`;
    }
  }
  return {
    ...peer,
    title,
    username: entity instanceof Api.Channel ? (entity.username ?? null) : null,
    topic: ref.topic,
  };
}
