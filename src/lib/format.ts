export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("uk-UA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Whole days between a date and now.
 *
 * Lives here rather than inline in a component: "now" is genuinely impure, and
 * a component that reads the clock while rendering is exactly what the React
 * Compiler's purity rule is there to catch.
 */
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso + "T00:00:00Z").getTime()) / 86_400_000);
}

export function formatMonthYear(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("uk-UA", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
