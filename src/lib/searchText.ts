/**
 * Accent- and case-insensitive substring matching for the client-side filters
 * on /faq and /locations.
 *
 * Deliberately not `slugify()`: that one mirrors the Postgres function and
 * strips everything outside [a-z0-9], which deletes Cyrillic wholesale — fine
 * for building slugs, useless for filtering Ukrainian questions. Here we only
 * fold diacritics and case, so "malaga" matches "Málaga" and "коментар"
 * still matches itself.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * True when every whitespace-separated term in `query` appears in at least one
 * of `fields`. Term-wise rather than whole-string so "alicante cnp" matches
 * "CNP Alicante NIE" regardless of word order.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fields.filter(Boolean).map((f) => normalizeForSearch(f as string)).join(" ");
  return terms.every((term) => haystack.includes(term));
}
