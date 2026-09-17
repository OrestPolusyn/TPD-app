import { getRequestConfig } from "next-intl/server";

// Single-locale app (Ukrainian UI only, see docs/SPEC.md "OUT OF SCOPE: Spanish UI").
// next-intl is used purely for message lookup / ICU plural formatting, not routing.
export const locale = "uk" as const;

export default getRequestConfig(async () => {
  const messages = (await import("../../messages/uk.json")).default;
  return {
    locale,
    messages,
  };
});
