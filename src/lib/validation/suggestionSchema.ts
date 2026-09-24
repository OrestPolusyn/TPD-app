import { z } from "zod";

/** What a correction can target — mirrors suggestion_field_t (0002, 0023). */
export const SUGGESTION_FIELDS = [
  "address",
  "postal_code",
  "phone",
  "email",
  "appointment_method",
  "appointment_url",
  "other",
] as const;
export type SuggestionField = (typeof SUGGESTION_FIELDS)[number];

export const suggestionSchema = z.object({
  location_id: z.string().min(1),
  field: z.enum(SUGGESTION_FIELDS),
  proposed_value: z.string().trim().min(1).max(500),
});

export type SuggestionInput = z.infer<typeof suggestionSchema>;

/** Edit payload: just the proposed value, since field/location cannot change. */
export const suggestedValueSchema = z.object({
  proposed_value: z.string().trim().min(1).max(500),
});
