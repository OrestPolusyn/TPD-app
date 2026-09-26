/**
 * Escapes text for Telegram's HTML parse mode. Every value that comes from a
 * person (a report comment, a suggested change, a name) goes through this
 * before it is placed in a message that uses <b>/<i>.
 */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** "📍 <b>Мадрид (Посуело-де-Аларкон)</b>" + the office's own name in italics. */
export function officeHeading(cityUkName: string, officeName: string): string {
  return `📍 <b>${esc(cityUkName)}</b>\n<i>${esc(officeName)}</i>`;
}
