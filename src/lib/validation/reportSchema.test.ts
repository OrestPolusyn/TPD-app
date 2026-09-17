import { describe, it, expect } from "vitest";
import { reportSchema } from "./reportSchema";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    location_id: "comisaria-lugo",
    event_date: "2024-01-15",
    outcome: "protection_granted",
    documents: [{ document_code: "international_passport", status: "requested" }],
    requested_list_complete: true,
    ...overrides,
  };
}

describe("reportSchema", () => {
  it("accepts a minimal valid report", () => {
    const result = reportSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("rejects a report with no documents", () => {
    const result = reportSchema.safeParse(baseInput({ documents: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a future event_date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = reportSchema.safeParse(baseInput({ event_date: future.toISOString().slice(0, 10) }));
    expect(result.success).toBe(false);
  });

  it("rejects an event_date before 2022-03-04", () => {
    const result = reportSchema.safeParse(baseInput({ event_date: "2022-01-01" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown outcome value", () => {
    const result = reportSchema.safeParse(baseInput({ outcome: "not_a_real_outcome" }));
    expect(result.success).toBe(false);
  });

  it("rejects 'other' requested without a comment naming it", () => {
    const result = reportSchema.safeParse(
      baseInput({
        documents: [
          { document_code: "international_passport", status: "requested" },
          { document_code: "other", status: "requested" },
        ],
        comment: null,
      })
    );
    expect(result.success).toBe(false);
  });

  it("accepts 'other' requested when a comment is present", () => {
    const result = reportSchema.safeParse(
      baseInput({
        documents: [
          { document_code: "international_passport", status: "requested" },
          { document_code: "other", status: "requested" },
        ],
        comment: "asked for a local residency permit",
      })
    );
    expect(result.success).toBe(true);
  });

  it("accepts 'other' as not_requested without a comment", () => {
    const result = reportSchema.safeParse(
      baseInput({
        documents: [
          { document_code: "international_passport", status: "requested" },
          { document_code: "other", status: "not_requested" },
        ],
      })
    );
    expect(result.success).toBe(true);
  });
});
