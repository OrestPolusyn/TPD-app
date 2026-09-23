import { z } from "zod";

export const commentSchema = z.object({
  report_id: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

export type CommentInput = z.infer<typeof commentSchema>;

export const flagSchema = z.object({
  target_type: z.enum(["report", "comment"]),
  target_id: z.string().uuid(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export type FlagInput = z.infer<typeof flagSchema>;

/** Edit payload: just the body, since report_id/user_id cannot change. */
export const commentBodySchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

/**
 * "Це актуально" / "Вже не так" on a community note. Sending the stance you
 * already hold takes it back, so there is no separate delete endpoint.
 */
export const noteConfirmationSchema = z.object({
  note_id: z.string().uuid(),
  stance: z.enum(["still_true", "changed"]),
});

export type NoteConfirmationInput = z.infer<typeof noteConfirmationSchema>;
