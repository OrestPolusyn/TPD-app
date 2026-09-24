import { describe, expect, it } from "vitest";
import messages from "../../messages/uk.json";
import { errorCopy } from "./errorCopy";

describe("error boundary copy", () => {
  it("matches messages/uk.json, so the two cannot drift apart", () => {
    expect(errorCopy).toEqual({
      errorGeneric: messages.common.errorGeneric,
      retry: messages.common.retry,
      errorDetails: messages.common.errorDetails,
    });
  });
});
