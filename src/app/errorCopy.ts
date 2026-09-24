/**
 * The three strings the root error boundary shows.
 *
 * error.tsx is a client component and part of every page's bundle, and it
 * cannot use next-intl (no provider is mounted, and the page that crashed may
 * be the one that would have supplied the messages). It used to import all of
 * messages/uk.json for these three strings, which put the whole translation
 * file — every page's copy, bot messages included — into the home page's
 * JavaScript and pushed it over its 150 KB budget. errorCopy.test.ts keeps
 * these identical to messages/uk.json.
 */
export const errorCopy = {
  errorGeneric: "Щось пішло не так.",
  retry: "Спробувати ще раз",
  errorDetails: "Технічні деталі",
} as const;
