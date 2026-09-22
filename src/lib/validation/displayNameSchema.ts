import { z } from "zod";

/** Empty/whitespace-only clears the nickname back to the Telegram-first-name
 * fallback — mirrors set_own_display_name's own trim+nullif in the DB. */
export const displayNameSchema = z.object({
  display_name: z.string().trim().max(60).nullable(),
});

export type DisplayNameInput = z.infer<typeof displayNameSchema>;
