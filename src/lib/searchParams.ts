/**
 * `docs` can arrive as a native multi-checkbox <form> submission (repeated
 * `docs=a&docs=b` params, which Next.js gives us as a string[]) or as a
 * hand-built/shared link (comma-joined `docs=a,b`). Accept both.
 */
export function normalizeDocsParam(docs: string | string[] | undefined): string[] {
  if (!docs) return [];
  const list = Array.isArray(docs) ? docs : docs.split(",");
  return list.map((d) => d.trim()).filter(Boolean);
}
