/**
 * What the owner pastes after /watch_add, turned into something to look up:
 * @name, name, t.me/name, t.me/name/<topic>, t.me/c/<id>/<topic>[/<msg>].
 * Invite links (t.me/+…) cannot be read without joining, so they are
 * refused — join in Telegram first, then add the group by its link.
 */
export interface SourceRef {
  username?: string;
  channelId?: string;
  topic: number | null;
}

export class SourceRefError extends Error {}

export function parseSourceRef(input: string): SourceRef {
  let raw = input.trim();
  if (!raw) throw new SourceRefError("empty");
  raw = raw.replace(/^(https?:\/\/)?(www\.)?(t|telegram)\.me\//i, "").split("?")[0].replace(/^\/+|\/+$/g, "");
  if (raw.startsWith("+") || raw.toLowerCase().startsWith("joinchat")) throw new SourceRefError("invite");
  raw = raw.replace(/^@/, "");

  const parts = raw.split("/");
  const topicAt = (i: number) => (parts[i] && /^\d+$/.test(parts[i]) ? Number(parts[i]) : null);

  if (parts[0] === "c" && parts[1]) {
    const chat = parts[1];
    return /^\d+$/.test(chat) ? { channelId: chat, topic: topicAt(2) } : { username: chat, topic: topicAt(2) };
  }
  if (/^-100\d+$/.test(parts[0])) return { channelId: parts[0].slice(4), topic: null };
  if (!/^[A-Za-z0-9_]{4,}$/.test(parts[0])) throw new SourceRefError("not_a_link");
  return { username: parts[0], topic: topicAt(1) };
}
