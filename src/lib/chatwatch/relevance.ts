/**
 * Is a chat message about temporary protection in Spain? The server half of
 * the filter the desktop chat collector uses — both read the same rules
 * (tools/chat-collector/relevance_rules.json), so a message is kept or
 * dropped the same way in either place.
 *
 * A score, not a keyword list: core terms (Резерв+, довідка, штамп, хурадо,
 * сіта, police) weigh most, cities and procedure words a little, and ads,
 * rentals and jobs count against.
 */
import rules from "../../../tools/chat-collector/relevance_rules.json";

export type RelevanceLevel = "off" | "normal" | "strict";

/**
 * The rules are written for Python's `re`, where \w is any letter. In JS it
 * is ASCII only, which would make "мокр\w*" never match — so it is spelled
 * out as Unicode letters and digits here.
 */
const WORD = "[\\p{L}\\p{N}_]";

function compile(stems: string[]): RegExp {
  const body = stems.map((s) => s.replace(/\\w/g, WORD)).join("|");
  return new RegExp(`(?<!${WORD})(?:${body})`, "giu");
}

const GROUPS: { points: number; pattern: RegExp }[] = [
  ...rules.groups.map((g) => ({ points: g.points, pattern: compile(g.stems) })),
  { points: rules.cityPoints, pattern: compile(Object.values(rules.cities).flat()) },
];

const CITY_PATTERNS: { city: string; pattern: RegExp }[] = Object.entries(rules.cities).map(([city, stems]) => ({
  city,
  pattern: compile(stems),
}));

const LEVELS = rules.levels as Record<RelevanceLevel, [number | null, boolean]>;

export function score(text: string): { total: number; core: boolean; hits: string[] } {
  let total = 0;
  let core = false;
  const hits = new Set<string>();
  for (const { points, pattern } of GROUPS) {
    const found = [...text.matchAll(pattern)].map((m) => m[0]);
    if (found.length === 0) continue;
    total += points;
    if (points >= 3) core = true;
    if (points > 0) for (const f of found) hits.add(f);
  }
  return { total, core, hits: [...hits].sort((a, b) => b.length - a.length) };
}

export function isRelevant(text: string, level: RelevanceLevel = "normal"): boolean {
  const [minimum, needsCore] = LEVELS[level] ?? LEVELS.normal;
  if (minimum === null) return true;
  if (text.trim().length < 20) return false;
  const { total, core } = score(text);
  return total >= minimum && (core || !needsCore);
}

/** The cities a message names, in the order it names them (Ukrainian names). */
export function citiesIn(text: string): string[] {
  const found: { city: string; at: number }[] = [];
  for (const { city, pattern } of CITY_PATTERNS) {
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    if (m) found.push({ city, at: m.index });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.city);
}
