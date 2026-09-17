export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("uk-UA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthYear(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("uk-UA", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
