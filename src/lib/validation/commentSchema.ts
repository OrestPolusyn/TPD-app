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
