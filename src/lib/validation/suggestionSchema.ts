import { z } from "zod";

export const suggestionSchema = z.object({
  location_id: z.string().min(1),
  field: z.enum(["address", "postal_code", "phone", "appointment_url"]),
  proposed_value: z.string().trim().min(1).max(500),
});

export type SuggestionInput = z.infer<typeof suggestionSchema>;
