/**
 * Mirrors the Postgres `slugify()` function in
 * supabase/migrations/0001_extensions_and_config.sql (unaccent + lowercase +
 * non-alnum runs collapsed to "-"). Used client-side for building /results
 * links from a province name without a round-trip to the DB.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
