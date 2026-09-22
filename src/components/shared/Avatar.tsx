const PALETTE = [
  "#e5484d",
  "#e8590c",
  "#ab6400",
  "#946800",
  "#2b9a66",
  "#12a594",
  "#0b8ce9",
  "#3762e0",
  "#8145e5",
  "#c2298a",
];

/** Deterministic so the same person always gets the same color, without
 * storing one — a plain string hash into a small, deliberately readable
 * palette (Slack/Telegram-style initial avatars). */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name,
  photoUrl,
  size = 36,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const dimension = `${size}px`;

  if (photoUrl) {
    return (
      // Avatar photos come from Telegram's CDN, an arbitrary/changing host —
      // not worth a next/image remotePatterns entry for a small decorative circle.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: dimension, height: dimension }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ width: dimension, height: dimension, background: colorFor(name), fontSize: `${Math.round(size * 0.42)}px` }}
    >
      {initial}
    </span>
  );
}
