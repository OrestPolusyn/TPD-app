import { z } from "zod";
import { DOCUMENT_CODES } from "@/lib/matching/types";

export const EARLIEST_EVENT_DATE = "2022-03-04";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date");

function todayMadridIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}

export const documentEntrySchema = z.object({
  document_code: z.enum(DOCUMENT_CODES),
  status: z.enum(["requested", "requested_missing", "not_requested"]),
});

export const reportSchema = z
  .object({
    location_id: z.string().min(1),
    event_date: isoDate.refine((d) => d <= todayMadridIso(), { message: "event_date_future" }).refine(
      (d) => d >= EARLIEST_EVENT_DATE,
      { message: "event_date_too_early" }
    ),
    outcome: z.enum(["protection_granted", "application_accepted_pending", "turned_away", "could_not_get_appointment"]),
    documents: z.array(documentEntrySchema).min(1, "documents_required"),
    appointment_type: z.enum(["booked_online_icp", "booked_by_email_or_phone", "walk_in"]).nullable().optional(),
    earliest_appointment_offered: isoDate.nullable().optional(),
    time_at_office: z.enum(["under_1h", "1_to_3h", "over_3h", "multiple_visits"]).nullable().optional(),
    people_count: z.number().int().min(1).max(10).nullable().optional(),
    // No longer collected from the form — the exhaustive checklist it used to
    // qualify is gone. Defaults true so a report the client always sends `true`
    // for (or, for any older caller, omits) lands in the "complete" matching
    // bucket rather than being silently downgraded to "incomplete".
    requested_list_complete: z.boolean().optional().default(true),
    military_obligations_apply: z.enum(["yes", "no", "prefer_not_to_say"]).nullable().optional(),
    comment: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const other = data.documents.find((d) => d.document_code === "other");
    if (other && (other.status === "requested" || other.status === "requested_missing")) {
      if (!data.comment || data.comment.trim().length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["comment"],
          message: "other_document_requires_comment",
        });
      }
    }
  });

export type ReportInput = z.infer<typeof reportSchema>;
