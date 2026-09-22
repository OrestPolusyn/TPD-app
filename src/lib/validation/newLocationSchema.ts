import { z } from "zod";

/**
 * /locations/new no longer asks for structured fields up front — one free
 * text field, read by a moderator and turned into real name/type/region/
 * province/city before publishing (see submit_new_location()'s p_notes).
 */
export const newLocationSchema = z.object({
  description: z.string().trim().min(10).max(2000),
});

export type NewLocationInput = z.infer<typeof newLocationSchema>;
